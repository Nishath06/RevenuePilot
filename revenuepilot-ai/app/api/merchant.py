"""
RevenuePilot AI — Merchant API
Prompt chips + recovery data for the Merchant Dashboard.
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
