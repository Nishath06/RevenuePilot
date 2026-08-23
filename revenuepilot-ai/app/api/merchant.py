"""
RevenuePilot AI — Merchant API
Prompt chips + recovery data + live merchant metrics for the Merchant Dashboard.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import verify_api_key
from app.models.response import PromptsResponse, RecoveryResponse
from app.services import merchant_service

router = APIRouter(prefix="/merchant", tags=["Merchant"])


@router.get(
    "/prompts",
    response_model=PromptsResponse,
    summary="Get suggested merchant prompt chips",
    description="Returns a curated list of clickable questions for the Merchant Dashboard.",
)
async def get_prompts(_: str = Depends(verify_api_key)) -> PromptsResponse:
    prompts = merchant_service.get_merchant_prompts()
    return PromptsResponse(prompts=prompts, total=len(prompts))


@router.get(
    "/recovery",
    response_model=RecoveryResponse,
    summary="Get revenue recovery opportunities",
    description="Returns abandoned carts, failed payments, and AI-generated recovery messages.",
)
async def get_recovery(_: str = Depends(verify_api_key)) -> RecoveryResponse:
    return await merchant_service.get_recovery_data()


@router.get(
    "/snapshot",
    summary="Full merchant dashboard snapshot",
    description="Returns all KPIs in one call for dashboard initialization.",
)
async def get_snapshot(_: str = Depends(verify_api_key)) -> dict:
    snapshot = await merchant_service.get_today_snapshot()
    return snapshot.model_dump()


@router.get(
    "/events",
    summary="Get recent merchant activity events",
    description="Returns AI Event Timeline feed including payments, inventory, orders, and recovery triggers.",
)
async def get_events(_: str = Depends(verify_api_key)) -> dict:
    events = await merchant_service.get_recent_events()
    return {"events": events, "total": len(events)}


# ── TASK 13 REQUIRED ENDPOINTS ─────────────────────────────────────────────

@router.get("/revenue-metrics", summary="Get detailed live revenue metrics")
async def get_revenue_metrics(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_revenue_metrics_detailed()


@router.get("/payment-metrics", summary="Get detailed live payment metrics")
async def get_payment_metrics(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_payment_metrics_detailed()


@router.get("/order-metrics", summary="Get detailed live order metrics")
async def get_order_metrics(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_order_metrics_detailed()


@router.get("/customer-metrics", summary="Get detailed live customer metrics")
async def get_customer_metrics(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_customer_metrics_detailed()


@router.get("/inventory-metrics", summary="Get detailed live inventory metrics")
async def get_inventory_metrics(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_inventory_metrics_detailed()


@router.get("/forecast", summary="Get predictive revenue forecast")
async def get_forecast(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_forecast_metrics_detailed()


@router.get("/incidents", summary="Get operational incidents and alerts")
async def get_incidents(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_incidents_metrics_detailed()


@router.get("/webhooks", summary="Get webhook observability metrics")
async def get_webhooks(_: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_webhooks_metrics_detailed()

