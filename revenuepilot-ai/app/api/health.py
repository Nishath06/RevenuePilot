"""
RevenuePilot AI — Health API (v4.2 Production)
Returns MongoDB connectivity, AI readiness, and AWS service status.

GET /health → production-ready health check with AWS service configuration status.
"""
from __future__ import annotations

import os
import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.agents.coordinator import get_coordinator
from app.core.config import settings
from app.db.mongodb import health_check as mongo_health

router = APIRouter(prefix="/health", tags=["Health"])

_start_time = time.monotonic()


def _is_aws_cloud_mode() -> bool:
    """Returns True if we have real AWS credentials and are NOT in local mode."""
    key_id = (settings.AWS_ACCESS_KEY_ID or "").strip()
    secret = (settings.AWS_SECRET_ACCESS_KEY or "").strip()
    mode = (settings.AWS_MODE or "local").strip().lower()
    cloud_aliases = {"cloud", "aws", "production", "prod"}
    has_creds = bool(key_id and secret and not key_id.startswith("your-"))
    return has_creds and mode in cloud_aliases


@router.get(
    "",
    summary="Service health check",
)
async def health() -> JSONResponse:
    """
    GET /health — Production health check.

    Returns:
      - status: healthy | degraded
      - mongodb: connected | disconnected
      - recovery_lambda: configured | not_configured
      - ses: configured | not_configured
      - sns: configured | not_configured
      - eventbridge: configured | not_configured
      - mode: CLOUD | LOCAL
    """
    mongo_ok = await mongo_health()
    coordinator = get_coordinator()

    cloud_mode = _is_aws_cloud_mode()
    mode_str = "CLOUD" if cloud_mode else "LOCAL"

    # SES configured = SES_FROM_EMAIL or SES_SENDER_EMAIL env var present
    ses_email = (
        os.environ.get("SES_FROM_EMAIL")
        or os.environ.get("SES_SENDER_EMAIL")
        or ""
    ).strip()
    ses_configured = bool(ses_email and cloud_mode)

    # SNS — same AWS credential check
    sns_configured = cloud_mode

    # Recovery Lambda
    lambda_name = (
        os.environ.get("AWS_LAMBDA_RECOVERY_NAME")
        or getattr(settings, "AWS_LAMBDA_RECOVERY_NAME", "")
        or "RecoveryLambda"
    ).strip()
    lambda_configured = bool(lambda_name and cloud_mode)

    # EventBridge
    event_bus = (
        os.environ.get("EVENT_BUS_NAME")
        or getattr(settings, "EVENT_BUS_NAME", "revenuepilot-event-bus")
        or ""
    ).strip()
    eventbridge_configured = bool(event_bus and cloud_mode)

    provider_name = (
        coordinator.provider.name if (coordinator and coordinator.provider) else settings.LLM_PROVIDER or "grok"
    )
    llm_status = "connected" if (coordinator and coordinator.ai_ready) else "degraded"

    return JSONResponse({
        "status": "healthy" if mongo_ok else "degraded",
        "mode": mode_str,
        "mongodb": mongo_ok,
        "ses": "configured" if ses_configured else "not_configured",
        "sns": "configured" if sns_configured else "not_configured",
        "eventbridge": "configured" if eventbridge_configured else "not_configured",
        "recovery_lambda": "configured" if lambda_configured else "not_configured",
        # Additional context
        "llm_provider": provider_name,
        "llm_status": llm_status,
        "ai_ready": coordinator.ai_ready if coordinator else False,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": round(time.monotonic() - _start_time, 1),
    })
