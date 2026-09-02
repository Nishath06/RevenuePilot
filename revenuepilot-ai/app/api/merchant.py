"""
RevenuePilot AI — Merchant API
Prompt chips + recovery data + live merchant metrics for the Merchant Dashboard.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import verify_api_key
from app.models.response import PromptsResponse, RecoveryResponse
from app.services import merchant_service
from app.db.mongodb import get_mongodb

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
async def get_recovery(period: str = "all", _: str = Depends(verify_api_key)) -> RecoveryResponse:
    return await merchant_service.get_recovery_data(period)


@router.post(
    "/recovery/send-email/{candidate_id}",
    summary="Send personalized recovery email to candidate",
)
async def send_candidate_email(candidate_id: str, _: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.send_candidate_email(candidate_id)


@router.post(
    "/recovery/send-sms/{candidate_id}",
    summary="Send personalized recovery SMS to candidate",
)
async def send_candidate_sms(candidate_id: str, _: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.send_candidate_sms(candidate_id)


@router.post(
    "/recovery/send-both/{candidate_id}",
    summary="Send multi-channel recovery (Email + SMS) to candidate",
)
async def send_candidate_both(candidate_id: str, _: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.send_candidate_both(candidate_id)


@router.post(
    "/recovery/skip/{candidate_id}",
    summary="Skip recovery for candidate",
)
async def skip_candidate(candidate_id: str, _: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.skip_candidate(candidate_id)


@router.patch(
    "/recovery/message/{candidate_id}",
    summary="Update edited email/SMS templates or notes for candidate",
)
async def update_candidate_message(candidate_id: str, payload: dict, _: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.update_candidate_message(candidate_id, payload)


@router.get(
    "/recovery/history/{candidate_id}",
    summary="Get recovery timeline history for candidate",
)
async def get_candidate_history(candidate_id: str, _: str = Depends(verify_api_key)) -> dict:
    return await merchant_service.get_candidate_history(candidate_id)



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


# ── INCIDENT MANAGEMENT ──────────────────────────────────────────────────────

@router.post("/incidents/{incident_id}/resolve", summary="Resolve an incident and persist to MongoDB")
async def resolve_incident(
    incident_id: str,
    payload: Optional[Dict[str, Any]] = None,
    _: str = Depends(verify_api_key)
) -> dict:
    """
    Marks an incident as resolved in MongoDB, storing resolution note and timestamp.
    """
    db = get_mongodb()
    resolution_note = (payload or {}).get("note", "Resolved by merchant")
    now_iso = datetime.now(timezone.utc).isoformat()

    result = await db.incidents.update_one(
        {"$or": [{"id": incident_id}, {"incident_id": incident_id}]},
        {
            "$set": {
                "status": "resolved",
                "resolved_at": now_iso,
                "resolution_note": resolution_note,
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Incident '{incident_id}' not found")
    return {
        "success": True,
        "incident_id": incident_id,
        "status": "resolved",
        "resolved_at": now_iso,
        "resolution_note": resolution_note,
    }


# ── MERCHANT SETTINGS (PERSISTENT) ────────────────────────────────────────────

@router.get("/settings", summary="Load merchant settings from MongoDB")
async def get_merchant_settings(
    merchant_id: str = "merch_default",
    _: str = Depends(verify_api_key)
) -> dict:
    db = get_mongodb()
    settings_doc = await db.merchant_settings.find_one({"merchant_id": merchant_id}, {"_id": 0})
    if not settings_doc:
        # Return sensible defaults
        return {
            "merchant_id": merchant_id,
            "business_name": "RevenuePilot Demo Store",
            "contact_email": "jpnishath@gmail.com",
            "notification_email": "jpnishath@gmail.com",
            "razorpay_key_id": "",
            "webhook_secret": "",
            "demo_mode": True,
            "email_alerts": True,
            "whatsapp_alerts": False,
            "ai_provider": "gemini",
        }
    return settings_doc


@router.post("/settings", summary="Persist merchant settings to MongoDB")
async def save_merchant_settings(
    payload: Dict[str, Any],
    _: str = Depends(verify_api_key)
) -> dict:
    db = get_mongodb()
    merchant_id = payload.get("merchant_id", "merch_default")
    # Never store raw secrets in DB — strip them
    safe_payload = {k: v for k, v in payload.items() if k not in {"razorpay_key_secret"}}
    safe_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.merchant_settings.update_one(
        {"merchant_id": merchant_id},
        {"$set": safe_payload},
        upsert=True
    )
    return {"success": True, "merchant_id": merchant_id, "message": "Settings saved successfully"}
