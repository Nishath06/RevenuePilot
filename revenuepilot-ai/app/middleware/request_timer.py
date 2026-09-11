"""
RevenuePilot AI — Request Timer Middleware
Logs every request with timing, method, path, and status code.
"""
from __future__ import annotations

import time
import uuid

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)


class RequestTimerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000
            logger.error(
                "Request failed",
                method=request.method,
                path=request.url.path,
                error=str(exc),
                execution_time_ms=round(elapsed, 2),
            )
            raise

        elapsed = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Execution-Time-Ms"] = str(round(elapsed, 2))

        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            execution_time_ms=round(elapsed, 2),
        )

        return response
