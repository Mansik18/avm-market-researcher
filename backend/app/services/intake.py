"""Intake dialogue service — one turn at a time.

Given the current ProjectContext + chat history + new user message, it:
  1. Calls the LLM with the intake skill as system prompt and `update_context` tool.
  2. Parses the tool arguments into a new ContextData + completeness/ready/summary.
  3. Returns (assistant_reply_text, new_context_data, completeness, ready, summary).

The caller (router) is responsible for persistence.
"""
import json
from dataclasses import dataclass

from ..schemas import ContextData
from .llm import LLMClient
from .skills import load_skill, load_knowledge


UPDATE_CONTEXT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "description": {"type": "string"},
        "audience": {"type": "string"},
        "geography": {"type": "string"},
        "stage": {"type": "string"},
        "price": {"type": "string"},
        "paying_customers": {"type": "integer"},
        "big_job": {"type": "string"},
        "pain_points": {"type": "array", "items": {"type": "string"}},
        "current_solutions": {"type": "array", "items": {"type": "string"}},
        "competitors_mentioned": {"type": "array", "items": {"type": "string"}},
        "segment_hypotheses": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "string"},
        "_completeness": {
            "type": "number",
            "description": "0..1 self-assessed fraction of critical context fields filled",
        },
        "_ready_for_analysis": {"type": "boolean"},
        "_summary": {
            "type": "string",
            "description": "Empty until ready_for_analysis=true; then 5-7 short bullets",
        },
        "_assistant_reply": {
            "type": "string",
            "description": "The user-facing reply text (one question OR the summary+confirmation)",
        },
    },
    "required": [
        "description", "audience", "geography", "stage", "price",
        "paying_customers", "big_job", "pain_points", "current_solutions",
        "competitors_mentioned", "segment_hypotheses", "notes",
        "_completeness", "_ready_for_analysis", "_summary", "_assistant_reply",
    ],
}


@dataclass
class IntakeTurnResult:
    reply_text: str
    context: ContextData
    completeness: float
    ready_for_analysis: bool
    summary: str


def _discussion_prompt(report_json: str) -> str:
    return f"""# Режим обсуждения результатов анализа

Ты — продуктовый аналитик. Пользователь уже прошёл интервью и получил отчёт по анализу рынка. Теперь он хочет обсудить результаты, задать вопросы, уточнить выводы.

## Твои задачи:
- Отвечай на вопросы по результатам анализа
- Помогай разобраться в сегментах, рисках, экономике
- Если пользователь даёт новую информацию (новые данные о клиентах, ценах, конкурентах) — обнови контекст через update_context
- Если новая информация существенна для выводов — предложи перезапустить анализ чтобы получить обновлённую версию отчёта
- Будь конкретным, ссылайся на данные из отчёта

## Правила:
- Короткие ответы. 2-5 предложений. Не лекции.
- Не повторяй весь отчёт целиком — пользователь его уже видит.
- Если пользователь дополняет контекст — обнови update_context и скажи что изменилось.
- Когда рекомендуешь перезапустить анализ — скажи прямо: «Рекомендую перезапустить анализ — нажми кнопку выше. Новая версия учтёт эти данные.»

## Текущий отчёт (для справки):
{report_json[:12000]}
"""


def _merge_context(current: ContextData, incoming: dict) -> ContextData:
    """Apply LLM-provided updates to current context, preserving known values
    when the LLM sends empties (common failure mode: tool_choice forces a full
    object, and the model blanks previously-known fields)."""
    merged = current.model_dump()
    for k, v in incoming.items():
        if k.startswith("_"):
            continue
        if v in ("", None, []):
            continue
        if k == "paying_customers" and v == 0 and merged.get(k, 0) > 0:
            continue
        merged[k] = v
    return ContextData(**merged)


async def run_intake_turn(
    *,
    llm: LLMClient,
    current_context: ContextData,
    history: list[dict],
    new_user_message: str,
    report_json: str = "",
) -> IntakeTurnResult:
    """Run one intake dialogue turn. `history` is the conversation BEFORE
    `new_user_message` was added.

    If `report_json` is provided, switches to discussion mode: the agent
    helps the user understand and refine the analysis results instead of
    asking intake questions."""
    has_report = bool(report_json)
    if has_report:
        system_prompt = _discussion_prompt(report_json)
    else:
        skill_body = load_skill("intake")
        knowledge = load_knowledge("onboarding")
        system_prompt = f"{knowledge}\n\n---\n\n{skill_body}" if knowledge else skill_body

    is_first = len(history) == 0 and not new_user_message.strip()
    if is_first:
        # Bypass LLM for the cold-start greeting — skill defines it verbatim.
        greeting = (
            "Привет. Я помогу разобраться с твоим продуктом и рынком. "
            "Расскажи одним-двумя предложениями — что ты делаешь?"
        )
        return IntakeTurnResult(
            reply_text=greeting,
            context=current_context,
            completeness=0.0,
            ready_for_analysis=False,
            summary="",
        )

    # Build messages: replay prior history, then user-provided context snapshot
    # combined with the new user message so the LLM has the full picture.
    ctx_preamble = (
        "Текущее состояние контекста (передано для твоего справки, не показывай пользователю):\n"
        f"{current_context.model_dump_json(indent=2)}"
    )
    messages: list[dict] = [{"role": "system", "content": ctx_preamble}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": new_user_message})

    result = await llm.complete_with_tool(
        system=system_prompt,
        messages=messages,
        tool_name="update_context",
        tool_description=(
            "Update the full ProjectContext AND provide the user-facing reply. "
            "Always pass the full current state of the context, not a diff."
        ),
        tool_schema=UPDATE_CONTEXT_SCHEMA,
    )
    tool_input = result.get("tool_input") or {}
    reply_text = (tool_input.get("_assistant_reply") or result.get("text") or "…").strip()
    completeness = float(tool_input.get("_completeness") or 0.0)
    ready = bool(tool_input.get("_ready_for_analysis") or False)
    summary = str(tool_input.get("_summary") or "")

    new_ctx = _merge_context(current_context, tool_input)

    return IntakeTurnResult(
        reply_text=reply_text,
        context=new_ctx,
        completeness=completeness,
        ready_for_analysis=ready,
        summary=summary,
    )
