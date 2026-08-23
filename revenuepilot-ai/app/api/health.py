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

    provider_name = coordinator.provider.name if (coordinator and coordinator.provider) else (settings.LLM_PROVIDER or "grok")
    llm_status = "connected" if (coordinator and coordinator.ai_ready) else "degraded"

    return HealthResponse(
        status="healthy" if mongo_ok else "degraded",
        mongodb="connected" if mongo_ok else "disconnected",
        llm_provider=provider_name,
        llm_status=llm_status,
        analytics_engine="ready",
        ai_ready=coordinator.ai_ready if coordinator else False,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        uptime_seconds=round(time.monotonic() - _start_time, 1),
    )
