"""Structured JSON logging for the entire backend.

Every log entry is a JSON line with:
  timestamp, level, logger, message, and extra fields (duration_ms, tokens, cost, etc.)

In production (Docker), logs go to stdout → docker logs → whatever log aggregator.
"""
import logging
import json
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Merge extra fields passed via `extra={...}` in log calls
        for key in ("duration_ms", "tokens_in", "tokens_out", "tokens_total",
                     "cost_usd", "model", "method", "path", "status_code",
                     "user_id", "project_id", "skill", "phase", "query",
                     "num_results", "error", "exa_results_count"):
            val = getattr(record, key, None)
            if val is not None:
                entry[key] = val
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = str(record.exc_info[1])
        return json.dumps(entry, ensure_ascii=False)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()
    root.addHandler(handler)
    # Quiet noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
