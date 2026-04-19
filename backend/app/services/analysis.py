"""Synchronous 4-phase market analysis pipeline.

Reads the full-analysis skill once, runs:
  Phase 1 — 4 parallel Exa searches + LLM extraction of structured facts
  Phase 2 — LLM generates 7-9 segments
  Phase 3 — parallel per-segment deep-dive (top-5) for scores + unit econ
  Phase 4 — LLM synthesis: verdict, positioning, risks, 90-day plan

Scoring is applied in Python after phase 3 using compute_unit_economics + score_segment.
Returns a fully-populated AnalysisReport. Takes ~60-180 seconds end-to-end.
"""
import asyncio
import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Callable

from ..schemas import (
    AnalysisReport,
    Competitor,
    ContextData,
    Risk,
    Segment,
    Source,
)
from .exa import ExaClient, ExaResult
from .llm import LLMClient
from .scoring import categorize, compute_unit_economics, score_segment
from .skills import load_skill, load_knowledge, load_skill_queries, render_query_group


log = logging.getLogger("analysis")

ProgressCb = Callable[[str, str], None]  # (phase_id, human-readable label)


# ---------- Exa query builders ----------

_CIS_MARKERS = {"россия", "russia", "снг", "cis", "казахстан", "kazakhstan", "беларусь",
                 "belarus", "узбекистан", "кыргызстан", "рф", "рус", "русскоязычн", "глобально"}


def _is_cis(geo: str) -> bool:
    geo_lower = geo.lower()
    return any(m in geo_lower for m in _CIS_MARKERS)


def _build_queries(ctx: ContextData, skill_name: str = "full-analysis") -> list[str]:
    """Load market-research queries from the skill's YAML config, templated with context."""
    cfg = load_skill_queries(skill_name)
    lang = "ru" if _is_cis(ctx.geography or "") else "en"
    return render_query_group(
        cfg, "market_research", lang,
        category=ctx.description or "product",
        geo=ctx.geography or "global",
        segment=ctx.audience or "target users",
        problem=ctx.big_job or (ctx.pain_points[0] if ctx.pain_points else "the core job"),
    )


def _build_review_queries(competitor_names: list[str], is_cis: bool,
                           skill_name: str = "full-analysis") -> list[str]:
    """Load per-competitor review queries from the skill's YAML config."""
    cfg = load_skill_queries(skill_name)
    lang = "ru" if is_cis else "en"
    queries = []
    for name in competitor_names[:5]:
        rendered = render_query_group(cfg, "competitor_reviews", lang, competitor=name)
        if rendered:
            queries.append(rendered[0])
    return queries


# ---------- JSON extraction ----------

_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _parse_json(raw: str) -> dict:
    """Extract a JSON object from an LLM response (3-tier fallback).

    Tier 1: parse whole response as JSON.
    Tier 2: find outermost {...} or [...] chunk, parse that.
    Tier 3: scan individual top-level {...} objects, parse each independently.
            If outermost was an array — one bad item doesn't kill the whole
            response. If outermost was an object with a list-valued field —
            we return the raw chunks and let the caller handle per-item parsing.

    Always returns a dict. If the LLM returned a top-level array, we wrap
    it as {"_items": [...]} so callers can detect + iterate.
    """
    raw = (raw or "").strip()
    m = _JSON_FENCE.search(raw)
    if m:
        raw = m.group(1).strip()
    if not raw:
        return {}

    # Tier 1: parse whole blob
    try:
        parsed = json.loads(raw)
        return {"_items": parsed} if isinstance(parsed, list) else parsed
    except json.JSONDecodeError:
        pass

    # Tier 2: find outermost JSON chunk and parse
    chunk = _largest_json_chunk(raw)
    if chunk is not None:
        try:
            parsed = json.loads(chunk)
            return {"_items": parsed} if isinstance(parsed, list) else parsed
        except json.JSONDecodeError:
            # Tier 3: if chunk is an array, scan {...} objects individually
            if chunk.lstrip().startswith("["):
                items = _scan_top_level_objects(chunk)
                if items:
                    return {"_items": items}

    # Last resort: scan the whole raw string for top-level {...} objects
    items = _scan_top_level_objects(raw)
    if items:
        # If exactly one object found, return it directly
        if len(items) == 1:
            return items[0]
        return {"_items": items}
    return {}


def _largest_json_chunk(s: str) -> str | None:
    """Return the outermost {...} or [...] span in s, whichever starts earliest."""
    first_obj = s.find("{")
    first_arr = s.find("[")
    candidates: list[tuple[int, str]] = []
    if first_obj >= 0:
        last = s.rfind("}")
        if last > first_obj:
            candidates.append((first_obj, s[first_obj : last + 1]))
    if first_arr >= 0:
        last = s.rfind("]")
        if last > first_arr:
            candidates.append((first_arr, s[first_arr : last + 1]))
    if not candidates:
        return None
    # Pick the one that starts earlier
    candidates.sort(key=lambda c: c[0])
    return candidates[0][1]


def _robust_items(value) -> list[dict]:
    """Given a value that should be a list of dicts, recover as much as possible.

    Handles:
    - already a list → return dicts, skip non-dicts
    - a string (malformed LLM output that came through as text) → scan {...} objects
    - None / other → []
    """
    if isinstance(value, list):
        return [v for v in value if isinstance(v, dict)]
    if isinstance(value, str):
        return _scan_top_level_objects(value)
    return []


def _scan_top_level_objects(s: str) -> list[dict]:
    """Scan string for balanced {...} objects at depth 0 (not inside strings).
    Returns list of successfully parsed dicts. Malformed ones are skipped.
    """
    out: list[dict] = []
    depth = 0
    start = -1
    in_str = False
    esc = False
    for i, ch in enumerate(s):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                chunk = s[start : i + 1]
                try:
                    parsed = json.loads(chunk)
                    if isinstance(parsed, dict):
                        out.append(parsed)
                except json.JSONDecodeError:
                    pass  # skip malformed — don't kill the batch
                start = -1
    return out


# ---------- Phase user-message builders ----------

LANG_RULE = "\n\nВАЖНО: Весь текст в JSON-ответе ДОЛЖЕН быть на русском языке. Даже если источники на английском — переводи все названия, описания, позиционирование, инсайты на русский. Исключение: имена конкурентов и URL оставляй как есть.\n"


def _context_block(ctx: ContextData) -> str:
    return (
        "Контекст проекта:\n" + ctx.model_dump_json(indent=2)
    )


def _search_block(queries: list[str], batches: list[list[ExaResult]]) -> str:
    parts = []
    for q, hits in zip(queries, batches):
        hit_dump = [
            {"title": h.title, "url": h.url, "text": h.text[:1500], "date": h.published_date}
            for h in hits[:8]
        ]
        parts.append(f"Запрос: {q}\nРезультаты:\n{json.dumps(hit_dump, ensure_ascii=False)[:6000]}")
    return "Результаты поиска через Exa:\n\n" + "\n\n---\n\n".join(parts)


# ---------- Phase implementations ----------

async def _phase1(
    llm: LLMClient,
    exa: ExaClient,
    skill_body: str,
    ctx: ContextData,
) -> tuple[list[Competitor], dict, list[Source]]:
    queries = _build_queries(ctx)
    batches = await asyncio.gather(*[exa.search(q, num_results=8) for q in queries])

    # Collect all unique sources from Exa results
    seen_urls: set[str] = set()
    all_sources: list[Source] = []
    for hits in batches:
        for h in hits:
            if h.url and h.url not in seen_urls:
                seen_urls.add(h.url)
                all_sources.append(Source(url=h.url, title=h.title))

    user_prompt = (
        f"{_context_block(ctx)}\n\n"
        f"{_search_block(queries, list(batches))}\n\n"
        "Задача фазы 1: извлеки из результатов поиска структурированные факты о рынке.\n\n"
        "Верни СТРОГО валидный JSON без какого-либо текста до или после:\n"
        "{\n"
        '  "competitors": [ { "name": "...", "url": "...", "pricing": "...", '
        '"positioning": "...", "strengths": ["..."], "weaknesses": ["..."], "unmet_job": "...", '
        '"source_urls": ["url1", "url2"] } ],\n'
        '  "trends": ["..."],\n'
        '  "non_consumers": { "description": "...", "barrier": "..." },\n'
        '  "tam_reasoning": "..."\n'
        "}\n\n"
        "До 8 конкурентов. Только то, что реально подтверждается в результатах. "
        "Если данных нет — ставь пустые значения и пиши это в trends/tam_reasoning."
        + LANG_RULE
    )
    raw = await llm.complete_text(system=skill_body, user=user_prompt, max_tokens=4096)
    parsed = _parse_json(raw)
    competitors_raw = _robust_items(parsed.get("competitors"))
    # If top-level was an array of competitors (no wrapping dict), fall back to that
    if not competitors_raw and "_items" in parsed:
        competitors_raw = _robust_items(parsed["_items"])
    competitors: list[Competitor] = []
    for c in competitors_raw[:8]:
        try:
            # Convert source_urls list to Source objects
            source_urls = c.pop("source_urls", []) or []
            c["sources"] = [
                Source(url=u, title="")
                for u in source_urls if isinstance(u, str) and u.startswith("http")
            ]
            competitors.append(Competitor(**c))
        except Exception as e:
            log.warning("competitor.parse_error", extra={"error": str(e), "phase": "market_research"})
            try:
                competitors.append(Competitor(name=c.get("name", "Unknown")))
            except Exception:
                continue
    market_facts = {
        "trends": parsed.get("trends", []) or [],
        "non_consumers": parsed.get("non_consumers", {}) or {},
        "tam_reasoning": parsed.get("tam_reasoning", "") or "",
    }
    # Phase 1b: fetch real user reviews for found competitors
    if competitors:
        cis = _is_cis(ctx.geography or "")
        review_queries = _build_review_queries([c.name for c in competitors], cis)
        try:
            review_batches = await asyncio.gather(*[exa.search(q, num_results=5) for q in review_queries])
            # Collect review sources
            for hits in review_batches:
                for h in hits:
                    if h.url and h.url not in seen_urls:
                        seen_urls.add(h.url)
                        all_sources.append(Source(url=h.url, title=h.title))
            # Ask LLM to extract real user quotes per competitor
            review_data = []
            for q, hits in zip(review_queries, review_batches):
                review_data.append({
                    "query": q,
                    "hits": [{"title": h.title, "url": h.url, "text": h.text[:1000]} for h in hits[:5]]
                })
            quote_prompt = (
                "Из результатов поиска отзывов извлеки реальные цитаты пользователей для каждого конкурента.\n"
                f"Конкуренты: {', '.join(c.name for c in competitors[:5])}\n\n"
                f"Результаты поиска:\n{json.dumps(review_data, ensure_ascii=False)[:8000]}\n\n"
                "Верни JSON: {\"quotes\": {\"Competitor Name\": [\"цитата 1\", \"цитата 2\"], ...}}\n"
                "Только реальные цитаты из текста результатов. Не придумывай. Максимум 3 цитаты на конкурента."
            )
            raw = await llm.complete_text(system="Ты извлекаешь цитаты из отзывов пользователей. Все цитаты переводи на русский язык.", user=quote_prompt + LANG_RULE, max_tokens=2048)
            quotes_parsed = _parse_json(raw)
            quotes_map = quotes_parsed.get("quotes", {}) or {}
            for comp in competitors:
                comp_quotes = quotes_map.get(comp.name, []) or []
                if comp_quotes and isinstance(comp_quotes, list):
                    comp.user_quotes = [str(q) for q in comp_quotes[:3]]
        except Exception as e:
            log.warning("reviews.fetch_error", extra={"error": str(e), "phase": "market_research"})

    return competitors, market_facts, all_sources


async def _phase2(
    llm: LLMClient,
    skill_body: str,
    ctx: ContextData,
    competitors: list[Competitor],
    market_facts: dict,
) -> list[Segment]:
    facts_block = json.dumps(
        {
            "competitors": [c.model_dump() for c in competitors],
            "market_facts": market_facts,
        },
        ensure_ascii=False,
    )[:10000]
    user_prompt = (
        f"{_context_block(ctx)}\n\n"
        f"Рыночные данные из фазы 1:\n{facts_block}\n\n"
        "Задача фазы 2: построй 7-9 сегментов. Обязательно включи один сегмент Non-consumers "
        "(люди с проблемой, которые не пользуются никаким решением). Каждый сегмент = "
        "[Кто] + [Struggling Moment — конкретная ситуация-триггер] + [Core Job].\n\n"
        "Верни СТРОГО валидный JSON без какого-либо текста до или после:\n"
        '{ "segments": [ {\n'
        '    "name": "...", "struggling_moment": "...", "core_job": "...",\n'
        '    "emotional_job": "...", "social_job": "...",\n'
        '    "tam_reasoning": "(описание bottom-up расчёта)",\n'
        '    "tam_usd": 0, "sam_usd": 0, "som_usd": 0,\n'
        '    "unmet_jobs": ["..."], "key_message": "...", "main_channel": "..."\n'
        "  } ] }\n\n"
        "Поля scores и unit_econ НЕ заполняй — они будут считаться в фазе 3."
        + LANG_RULE
    )
    raw = await llm.complete_text(system=skill_body, user=user_prompt, max_tokens=4096)
    parsed = _parse_json(raw)
    segments: list[Segment] = []
    segments_raw = _robust_items(parsed.get("segments"))
    if not segments_raw and "_items" in parsed:
        segments_raw = _robust_items(parsed["_items"])
    for s in segments_raw:
        try:
            # Coerce numeric fields that LLM sometimes returns as strings
            for num_field in ("tam_usd", "sam_usd", "som_usd"):
                if num_field in s and isinstance(s[num_field], str):
                    cleaned = re.sub(r"[^\d.]", "", s[num_field])
                    s[num_field] = float(cleaned) if cleaned else 0
            segments.append(Segment(**s))
        except Exception as e:
            log.warning("segment.parse_error", extra={
                "error": f"{type(e).__name__}: {e}",
                "phase": "segmentation",
            })
            # Try with just the required field
            try:
                segments.append(Segment(name=s.get("name", f"Segment {len(segments)+1}"),
                                        struggling_moment=str(s.get("struggling_moment", "")),
                                        core_job=str(s.get("core_job", ""))))
            except Exception:
                continue
    return segments


async def _phase3_one_segment(
    llm: LLMClient,
    skill_body: str,
    ctx: ContextData,
    segment: Segment,
    competitors: list[Competitor],
) -> dict:
    seg_block = segment.model_dump_json(indent=2)
    comps_block = json.dumps([c.model_dump() for c in competitors[:5]], ensure_ascii=False)[:4000]
    user_prompt = (
        f"{_context_block(ctx)}\n\n"
        f"Сегмент для глубокого анализа:\n{seg_block}\n\n"
        f"Конкуренты для справки:\n{comps_block}\n\n"
        "Задача фазы 3: глубоко проанализируй ОДИН сегмент.\n"
        "Оцени оси по шкале 0-100:\n"
        "- job_fit — насколько точно продукт попадает в Struggling Moment + "
        "закрывает Emotional/Social Job\n"
        "- market_size — SAM в абсолютных числах (bottom-up)\n"
        "- economics — ожидаемое LTV/CAC (healthy >3 = 90+, moderate 1-3 = 50-70, "
        "unhealthy <1 = 0)\n"
        "- moat — уникальность позиции, есть ли что-то нескопируемое за 3 месяца\n\n"
        "Оцени unit econ (если нет данных — используй разумные бенчмарки категории):\n"
        "- amppu (avg monthly paying user revenue, USD)\n"
        "- margin_pct (0-100)\n"
        "- monthly_churn_pct (0-100)\n"
        "- cac (USD)\n\n"
        "Оцени 4 силы переключения (0-100 каждая):\n"
        "- added_value — насколько продукт лучше текущего решения сегмента\n"
        "- problem_severity — насколько сильно болит проблема (срочность, частота, цена ошибки)\n"
        "- barriers — стоимость/сложность перехода (интеграция, обучение, контракт)\n"
        "- habit_strength — инерция текущего поведения (привычка, страх перемен)\n"
        "Switch Score = (added_value + problem_severity) - (barriers + habit_strength). "
        "Если < 0 — люди не переключатся даже при хорошем продукте.\n\n"
        "Также напиши Devil's Advocate — главный контраргумент, почему этот сегмент "
        "может оказаться ловушкой (ложный спрос, скрытые барьеры, конкуренция за внимание).\n\n"
        "Верни СТРОГО валидный JSON:\n"
        "{\n"
        '  "segment_name": "...",\n'
        '  "switch_story": "...",\n'
        '  "unmet_jobs": ["..."],\n'
        '  "key_message": "...",\n'
        '  "main_channel": "...",\n'
        '  "devils_advocate": "...",\n'
        '  "four_forces": {"added_value":0, "problem_severity":0, "barriers":0, "habit_strength":0},\n'
        '  "scores": {"job_fit":0, "market_size":0, "economics":0, "moat":0},\n'
        '  "unit_econ_inputs": {"amppu":0, "margin_pct":0, "monthly_churn_pct":0, "cac":0}\n'
        "}"
        + LANG_RULE
    )
    raw = await llm.complete_text(system=skill_body, user=user_prompt, max_tokens=2048)
    return _parse_json(raw)


def _apply_deep_dive(segment: Segment, dd: dict) -> Segment:
    scores = dd.get("scores", {}) or {}
    ue_in = dd.get("unit_econ_inputs", {}) or {}
    forces = dd.get("four_forces", {}) or {}
    ue = compute_unit_economics(
        amppu=float(ue_in.get("amppu", 0) or 0),
        margin_pct=float(ue_in.get("margin_pct", 0) or 0),
        monthly_churn_pct=float(ue_in.get("monthly_churn_pct", 0) or 0),
        cac=float(ue_in.get("cac", 0) or 0),
    )
    total = score_segment(
        job_fit=float(scores.get("job_fit", 0) or 0),
        market_size=float(scores.get("market_size", 0) or 0),
        economics=float(scores.get("economics", 0) or 0),
        moat=float(scores.get("moat", 0) or 0),
        ltv_cac=ue.ltv_cac,
    )
    # 4 Forces
    f_added = float(forces.get("added_value", 0) or 0)
    f_severity = float(forces.get("problem_severity", 0) or 0)
    f_barriers = float(forces.get("barriers", 0) or 0)
    f_habits = float(forces.get("habit_strength", 0) or 0)
    switch_score = (f_added + f_severity) - (f_barriers + f_habits)

    return segment.model_copy(
        update={
            "switch_story": dd.get("switch_story", segment.switch_story) or segment.switch_story,
            "unmet_jobs": dd.get("unmet_jobs", segment.unmet_jobs) or segment.unmet_jobs,
            "key_message": dd.get("key_message", segment.key_message) or segment.key_message,
            "main_channel": dd.get("main_channel", segment.main_channel) or segment.main_channel,
            "devils_advocate": dd.get("devils_advocate", "") or "",
            "force_added_value": f_added,
            "force_problem_severity": f_severity,
            "force_barriers": f_barriers,
            "force_habit_strength": f_habits,
            "switch_score": switch_score,
            "score_job_fit": float(scores.get("job_fit", 0) or 0),
            "score_market_size": float(scores.get("market_size", 0) or 0),
            "score_economics": float(scores.get("economics", 0) or 0),
            "score_moat": float(scores.get("moat", 0) or 0),
            "total_score": total,
            "category": categorize(total, ltv_cac=ue.ltv_cac, switch_score=switch_score),
            "unit_econ": ue,
        }
    )


async def _phase4(
    llm: LLMClient,
    skill_body: str,
    ctx: ContextData,
    scored_segments: list[Segment],
    competitors: list[Competitor],
    market_facts: dict,
) -> dict:
    segs_block = json.dumps([s.model_dump() for s in scored_segments], ensure_ascii=False)[:12000]
    user_prompt = (
        f"{_context_block(ctx)}\n\n"
        f"Все сегменты с оценками:\n{segs_block}\n\n"
        f"Рыночные факты: {json.dumps(market_facts, ensure_ascii=False)[:3000]}\n\n"
        "Задача фазы 4: синтезируй финальный вердикт.\n\n"
        "Правила вердикта:\n"
        "- GO — есть хотя бы один A-сегмент (>=70 баллов) с LTV/CAC > 3\n"
        "- GO_CONDITIONAL — есть A или сильный B, но требует условия\n"
        "- PIVOT — ни одного A, но есть сильный незакрытый Job где-то ещё\n"
        "- NO_GO — ни один сегмент не прошёл Gate\n\n"
        "Верни СТРОГО валидный JSON:\n"
        "{\n"
        '  "verdict": "GO" | "GO_CONDITIONAL" | "PIVOT" | "NO_GO",\n'
        '  "verdict_condition": "...",\n'
        '  "positioning": "Для [кто] — [продукт] — единственный способ [X] без [Y]",\n'
        '  "main_insight": "...(нетривиальный вывод, не очевидный из гугла)",\n'
        '  "asymmetric_opportunity": "...",\n'
        '  "top_risks": [ {"assumption":"фальсифицируемая гипотеза", "probability":1, "impact":1, "score":1, '
        '"metric":"что измерять", "threshold":"порог успеха/провала", '
        '"experiment":"конкретный 30-дневный эксперимент"} ],\n'
        '  "competitor_response": "...",\n'
        '  "next_three_steps": ["шаг 1", "шаг 2", "шаг 3"],\n'
        '  "plan_90d": ["Месяц 1: ...", "Месяц 2: ...", "Месяц 3: ..."]\n'
        "}\n\n"
        "top_risks: 8-10 штук, каждый со score = probability * impact (1-25).\n"
        "Каждый риск должен быть ФАЛЬСИФИЦИРУЕМЫМ — не 'может не взлететь', "
        "а 'мы предполагаем что X ≥ Y, если меньше — модель ломается'.\n"
        "metric: что конкретно измеряем. threshold: при каком значении гипотеза провалена."
        + LANG_RULE
    )
    raw = await llm.complete_text(system=skill_body, user=user_prompt, max_tokens=4096)
    return _parse_json(raw)


# ---------- Public entrypoint ----------

async def run_market_analysis(
    ctx: ContextData,
    *,
    llm: LLMClient,
    exa: ExaClient,
    progress: ProgressCb | None = None,
) -> AnalysisReport:
    def _p(pid: str, label: str):
        if progress:
            progress(pid, label)

    skill_body = load_skill("full-analysis")

    # Per-phase knowledge — only load what each phase actually needs
    def _system(knowledge_names: list[str]) -> str:
        kb = load_knowledge(*knowledge_names) if knowledge_names else ""
        return f"{kb}\n\n---\n\n{skill_body}" if kb else skill_body

    PHASE_KNOWLEDGE: dict[str, list[str]] = {
        "market_research": [],                                          # pure Exa extraction, no methodology needed
        "segmentation": ["segmentation", "abcdx-segmentation"],         # how to build segments
        "deep_dive": ["unit-economics", "value-mechanics"],             # scoring + mechanics for each segment
        "synthesis": ["product-strategy", "mechanics", "do-quantitative-research"],  # strategic framing + action plan
    }

    t_start = time.monotonic()

    _p("market_research", "Собираю данные через Exa")
    t0 = time.monotonic()
    competitors, market_facts, all_sources = await _phase1(
        llm, exa, _system(PHASE_KNOWLEDGE["market_research"]), ctx)
    log.info("phase.done", extra={"phase": "market_research", "duration_ms": round((time.monotonic() - t0) * 1000)})

    _p("segmentation", "Строю сегменты")
    t0 = time.monotonic()
    segments = await _phase2(
        llm, _system(PHASE_KNOWLEDGE["segmentation"]), ctx, competitors, market_facts)
    log.info("phase.done", extra={"phase": "segmentation", "duration_ms": round((time.monotonic() - t0) * 1000)})
    if not segments:
        return AnalysisReport(
            verdict="NO_GO",
            main_insight="Не удалось построить сегменты — возможно не хватает данных в контексте проекта.",
            competitors=competitors,
            created_at=datetime.utcnow(),
        )

    _p("deep_dive", "Глубокий анализ топ-5")
    t0 = time.monotonic()
    top = segments[:5]
    sys3 = _system(PHASE_KNOWLEDGE["deep_dive"])
    deep_dives = await asyncio.gather(
        *[_phase3_one_segment(llm, sys3, ctx, s, competitors) for s in top]
    )
    scored_top = [_apply_deep_dive(s, dd) for s, dd in zip(top, deep_dives)]
    all_segments = scored_top + segments[5:]
    log.info("phase.done", extra={"phase": "deep_dive", "duration_ms": round((time.monotonic() - t0) * 1000)})

    _p("synthesis", "Финальный синтез")
    t0 = time.monotonic()
    synthesis = await _phase4(llm, _system(PHASE_KNOWLEDGE["synthesis"]), ctx, scored_top, competitors, market_facts)
    log.info("phase.done", extra={"phase": "synthesis", "duration_ms": round((time.monotonic() - t0) * 1000)})

    risks: list[Risk] = []
    for r in _robust_items(synthesis.get("top_risks")):
        try:
            risks.append(Risk(**r))
        except Exception:
            continue

    total_duration = round((time.monotonic() - t_start) * 1000)
    log.info("analysis.complete", extra={
        "duration_ms": total_duration,
        "phase": "all",
    })

    return AnalysisReport(
        verdict=synthesis.get("verdict", "NO_GO") or "NO_GO",
        verdict_condition=synthesis.get("verdict_condition", "") or "",
        positioning=synthesis.get("positioning", "") or "",
        main_insight=synthesis.get("main_insight", "") or "",
        asymmetric_opportunity=synthesis.get("asymmetric_opportunity", "") or "",
        competitors=competitors,
        segments=all_segments,
        top_risks=risks,
        competitor_response=synthesis.get("competitor_response", "") or "",
        next_three_steps=synthesis.get("next_three_steps", []) or [],
        plan_90d=synthesis.get("plan_90d", []) or [],
        sources=all_sources,
        created_at=datetime.utcnow(),
    )
