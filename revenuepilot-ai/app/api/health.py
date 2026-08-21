"""
RevenuePilot AI — Health API
Returns MongoDB connectivity + AI readiness status.
"""
from __future__ import annotations

import time

from fastapi import APIRouter

from app.agents.coordinator import get_coordinator
from app.core.config import settings
from app.db.mongodb import health_check as mongo_health
from app.models.response import HealthResponse

router = APIRouter(prefix="/health", tags=["Health"])

_start_time = time.monotonic()


@router.get(
    "",
    response_model=HealthResponse,
    summary="Service health check",
)
async def health() -> HealthResponse:
    """Check MongoDB connectivity and AI readiness."""
    mongo_ok = await mongo_health()
    coordinator = get_coordinator()

    return HealthResponse(
        status="healthy" if mongo_ok else "degraded",
        mongodb="connected" if mongo_ok else "disconnected",
        ai_ready=coordinator.ai_ready,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        uptime_seconds=round(time.monotonic() - _start_time, 1),
    )
