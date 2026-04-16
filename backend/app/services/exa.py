"""Thin Exa HTTP client with structured logging."""
import logging
import time
from dataclasses import dataclass, asdict
import httpx

from ..config import settings

log = logging.getLogger("exa")


@dataclass
class ExaResult:
    title: str
    url: str
    text: str
    published_date: str = ""
    score: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


class ExaClient:
    BASE = "https://api.exa.ai"

    def __init__(self, api_key: str | None = None, timeout: float = 30.0):
        self._headers = {
            "x-api-key": api_key or settings.exa_api_key,
            "content-type": "application/json",
        }
        self._timeout = timeout

    async def search(self, query: str, num_results: int = 8) -> list[ExaResult]:
        body = {
            "query": query,
            "numResults": num_results,
            "type": "auto",
            "contents": {"text": {"maxCharacters": 2000}, "highlights": True},
        }
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(base_url=self.BASE, timeout=self._timeout) as c:
                r = await c.post("/search", json=body, headers=self._headers)
                r.raise_for_status()
                data = r.json()
            results = [
                ExaResult(
                    title=it.get("title", "") or "",
                    url=it.get("url", "") or "",
                    text=it.get("text", "") or "",
                    published_date=it.get("publishedDate", "") or "",
                    score=float(it.get("score", 0.0) or 0.0),
                )
                for it in data.get("results", [])
            ]
            duration = round((time.monotonic() - t0) * 1000)
            log.info("exa.search", extra={
                "query": query[:200],
                "num_results": num_results,
                "exa_results_count": len(results),
                "duration_ms": duration,
            })
            return results
        except Exception as e:
            duration = round((time.monotonic() - t0) * 1000)
            log.error("exa.search.error", extra={
                "query": query[:200],
                "error": f"{type(e).__name__}: {e}",
                "duration_ms": duration,
            })
            raise
