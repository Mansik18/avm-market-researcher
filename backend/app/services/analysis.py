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
import re
from datetime import datetime
from typing import Any, Callable

from ..schemas import (
    AnalysisReport,
    Competitor,
    ContextData,
    Risk,
    Segment,
)
from .exa import ExaClient, ExaResult
from .llm import LLMClient
from .scoring import categorize, compute_unit_economics, score_segment
from .skills import load_skill


ProgressCb = Callable[[str, str], None]  # (phase_id, human-readable label)


# ---------- Exa query builders ----------

def _build_queries(ctx: ContextData) -> list[str]:
    category = ctx.description or "product"
    geo = ctx.geography or "global"
    segment = ctx.audience or "target users"
    problem = ctx.big_job or (ctx.pain_points[0] if ctx.pain_points else "the core job to be done")
    return [
        f"comparison of {category} competitors pricing and positioning {geo} 2026",
        f"{category} market size and growth trends {geo} 2025 2026",
        f"why {segment} struggles with {problem} and does not use existing solutions {geo}",
        f"honest reviews and complaints about {category} what users dislike 2025 2026",
    ]


# ---------- JSON extraction ----------

_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _parse_json(raw: str) -> dict:
    """Extract a JSON object from an LLM response. Strips code fences if present."""
    raw = raw.strip()
    m = _JSON_FENCE.search(raw)
    if m:
        raw = m.group(1).strip()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to find the largest {...} chunk
        first = raw.find("{")
        last = raw.rfind("}")
        if first >= 0 and last > first:
            try:
                return json.loads(raw[first : last + 1])
            except json.JSONDecodeError:
                pass
    return {}


# ---------- Phase user-message builders ----------

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
) -> tuple[list[Competitor], dict]:
    queries = _build_queries(ctx)
    batches = await asyncio.gather(*[exa.search(q, num_results=8) for q in queries])

    user_prompt = (
        f"{_context_block(ctx)}\n\n"
        f"{_search_block(queries, list(batches))}\n\n"
        "Задача фазы 1: извлеки из результатов поиска структурированные факты о рынке.\n\n"
        "Верни СТРОГО валидный JSON без какого-либо текста до или после:\n"
        "{\n"
        '  "competitors": [ { "name": "...", "url": "...", "pricing": "...", '
        '"positioning": "...", "strengths": ["..."], "weaknesses": ["..."], "unmet_job": "..." } ],\n'
        '  "trends": ["..."],\n'
        '  "non_consumers": { "description": "...", "barrier": "..." },\n'
        '  "tam_reasoning": "..."\n'
        "}\n\n"
        "До 8 конкурентов. Только то, что реально подтверждается в результатах. "
        "Если данных нет — ставь пустые значения и пиши это в trends/tam_reasoning."
    )
    raw = await llm.complete_text(system=skill_body, user=user_prompt, max_tokens=4096)
    parsed = _parse_json(raw)
    competitors_raw = parsed.get("competitors", []) or []
    competitors: list[Competitor] = []
    for c in competitors_raw[:8]:
        try:
            competitors.append(Competitor(**c))
        except Exception:
            continue
    market_facts = {
        "trends": parsed.get("trends", []) or [],
        "non_consumers": parsed.get("non_consumers", {}) or {},
        "tam_reasoning": parsed.get("tam_reasoning", "") or "",
    }
    return competitors, market_facts


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
    )
    raw = await llm.complete_text(system=skill_body, user=user_prompt, max_tokens=4096)
    parsed = _parse_json(raw)
    segments: list[Segment] = []
    for s in parsed.get("segments", []) or []:
        try:
            segments.append(Segment(**s))
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
        "Верни СТРОГО валидный JSON:\n"
        "{\n"
        '  "segment_name": "...",\n'
        '  "switch_story": "...",\n'
        '  "unmet_jobs": ["..."],\n'
        '  "key_message": "...",\n'
        '  "main_channel": "...",\n'
        '  "scores": {"job_fit":0, "market_size":0, "economics":0, "moat":0},\n'
        '  "unit_econ_inputs": {"amppu":0, "margin_pct":0, "monthly_churn_pct":0, "cac":0}\n'
        "}"
    )
    raw = await llm.complete_text(system=skill_body, user=user_prompt, max_tokens=2048)
    return _parse_json(raw)


def _apply_deep_dive(segment: Segment, dd: dict) -> Segment:
    scores = dd.get("scores", {}) or {}
    ue_in = dd.get("unit_econ_inputs", {}) or {}
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
    return segment.model_copy(
        update={
            "switch_story": dd.get("switch_story", segment.switch_story) or segment.switch_story,
            "unmet_jobs": dd.get("unmet_jobs", segment.unmet_jobs) or segment.unmet_jobs,
            "key_message": dd.get("key_message", segment.key_message) or segment.key_message,
            "main_channel": dd.get("main_channel", segment.main_channel) or segment.main_channel,
            "score_job_fit": float(scores.get("job_fit", 0) or 0),
            "score_market_size": float(scores.get("market_size", 0) or 0),
            "score_economics": float(scores.get("economics", 0) or 0),
            "score_moat": float(scores.get("moat", 0) or 0),
            "total_score": total,
            "category": categorize(total),
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
        '  "top_risks": [ {"assumption":"...", "probability":1, "impact":1, "score":1, '
        '"experiment":"30-дневный эксперимент с метрикой"} ],\n'
        '  "competitor_response": "...",\n'
        '  "next_three_steps": ["шаг 1", "шаг 2", "шаг 3"],\n'
        '  "plan_90d": ["Месяц 1: ...", "Месяц 2: ...", "Месяц 3: ..."]\n'
        "}\n\n"
        "top_risks: 3-5 штук, каждый со score = probability * impact (1-25)."
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

    _p("market_research", "Собираю данные через Exa")
    competitors, market_facts = await _phase1(llm, exa, skill_body, ctx)

    _p("segmentation", "Строю сегменты")
    segments = await _phase2(llm, skill_body, ctx, competitors, market_facts)
    if not segments:
        return AnalysisReport(
            verdict="NO_GO",
            main_insight="Не удалось построить сегменты — возможно не хватает данных в контексте проекта.",
            competitors=competitors,
            created_at=datetime.utcnow(),
        )

    _p("deep_dive", "Глубокий анализ топ-5")
    top = segments[:5]
    deep_dives = await asyncio.gather(
        *[_phase3_one_segment(llm, skill_body, ctx, s, competitors) for s in top]
    )
    scored_top = [_apply_deep_dive(s, dd) for s, dd in zip(top, deep_dives)]
    all_segments = scored_top + segments[5:]

    _p("synthesis", "Финальный синтез")
    synthesis = await _phase4(llm, skill_body, ctx, scored_top, competitors, market_facts)

    risks: list[Risk] = []
    for r in synthesis.get("top_risks", []) or []:
        try:
            risks.append(Risk(**r))
        except Exception:
            continue

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
        created_at=datetime.utcnow(),
    )
