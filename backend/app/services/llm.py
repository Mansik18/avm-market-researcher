"""OpenAI-compatible LLM client with structured logging.

Every LLM call logs: model, tokens (in/out/total), estimated cost, duration.
"""
import json
import logging
import time
from openai import AsyncOpenAI

from ..config import settings

log = logging.getLogger("llm")

# Rough token pricing (USD per 1K tokens) — adjust to your proxy's actual cost
TOKEN_PRICE_IN = 0.005   # per 1K input tokens
TOKEN_PRICE_OUT = 0.015  # per 1K output tokens


def _estimate_cost(tokens_in: int, tokens_out: int) -> float:
    return (tokens_in / 1000 * TOKEN_PRICE_IN) + (tokens_out / 1000 * TOKEN_PRICE_OUT)


class LLMClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None,
                 model: str | None = None):
        self._client = AsyncOpenAI(
            api_key=api_key or settings.llm_api_key,
            base_url=base_url or settings.llm_base_url,
        )
        self._model = model or settings.llm_model

    async def complete_text(
        self,
        *,
        system: str,
        user: str,
        max_tokens: int = 4096,
    ) -> str:
        t0 = time.monotonic()
        resp = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        duration = round((time.monotonic() - t0) * 1000)
        usage = resp.usage
        tokens_in = usage.prompt_tokens if usage else 0
        tokens_out = usage.completion_tokens if usage else 0
        tokens_total = tokens_in + tokens_out
        cost = _estimate_cost(tokens_in, tokens_out)

        log.info("llm.complete_text", extra={
            "model": resp.model or self._model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "tokens_total": tokens_total,
            "cost_usd": round(cost, 5),
            "duration_ms": duration,
        })

        return (resp.choices[0].message.content or "").strip()

    async def complete_with_tool(
        self,
        *,
        system: str,
        messages: list[dict],
        tool_name: str,
        tool_description: str,
        tool_schema: dict,
        max_tokens: int = 2048,
    ) -> dict:
        """Returns {"text": str, "tool_input": dict | None}."""
        full_messages: list[dict] = [{"role": "system", "content": system}]
        full_messages.extend(messages)

        t0 = time.monotonic()
        resp = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=max_tokens,
            messages=full_messages,  # type: ignore[arg-type]
            tools=[{
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": tool_description,
                    "parameters": tool_schema,
                },
            }],
            tool_choice={"type": "function", "function": {"name": tool_name}},
        )
        duration = round((time.monotonic() - t0) * 1000)
        usage = resp.usage
        tokens_in = usage.prompt_tokens if usage else 0
        tokens_out = usage.completion_tokens if usage else 0
        tokens_total = tokens_in + tokens_out
        cost = _estimate_cost(tokens_in, tokens_out)

        log.info("llm.complete_with_tool", extra={
            "model": resp.model or self._model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "tokens_total": tokens_total,
            "cost_usd": round(cost, 5),
            "duration_ms": duration,
        })

        msg = resp.choices[0].message
        text = (msg.content or "").strip()
        tool_input: dict | None = None
        if msg.tool_calls:
            for tc in msg.tool_calls:
                if tc.function.name == tool_name:
                    try:
                        tool_input = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError:
                        tool_input = None
                    break
        return {"text": text, "tool_input": tool_input}
