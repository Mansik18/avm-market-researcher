"""OpenAI-compatible LLM client (points at the proxy configured in .env).

Thin wrapper around the openai AsyncOpenAI client with two helpers we actually
use from services: `complete_text` (single-shot, returns a string) and
`complete_with_tool` (single-shot with one function-calling tool, returns
both visible text and the parsed tool arguments).
"""
import json
from openai import AsyncOpenAI

from ..config import settings


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
        resp = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
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
