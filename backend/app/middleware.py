"""Request logging middleware — logs every HTTP request with duration, status, user."""
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = logging.getLogger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        t0 = time.monotonic()
        response = await call_next(request)
        duration = round((time.monotonic() - t0) * 1000)

        # Skip noisy paths
        if request.url.path in ("/health", "/favicon.ico"):
            return response

        # Try to extract user_id from request state (set by auth dependency)
        user_id = getattr(request.state, "user_id", None)

        log.info("request", extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration,
            "user_id": user_id,
        })
        return response
