"""
RevenuePilot AI — Chat API
POST /chat — Routes merchant questions through the multi-agent system.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException, status

from app.agents.coordinator import get_coordinator
from app.core.logging import get_logger
from app.core.security import verify_api_key
from app.models.request import ChatRequest
from app.models.response import ChatResponse

router = APIRouter(prefix="/chat", tags=["Chat"])
logger = get_logger(__name__)


@router.post(
    "",
    response_model=ChatResponse,
    summary="Ask the AI Business Analyst",
    description="Send a natural language merchant question and receive a structured AI response with live metrics.",
)
async def chat(
    request: ChatRequest,
    _: str = Depends(verify_api_key),
) -> ChatResponse:
    """
    Routes merchant questions to the correct specialist agent
    via intent classification. Returns structured metrics + recommendations.
    """
    coordinator = get_coordinator()
    start = time.perf_counter()
    logger.info("Chat request received", message=request.message[:100])

    mid = request.merchant_id or "merch_default"
    conv_id = request.conversation_id

    # Create conversation if missing
    from app.services.ai_memory_service import ai_memory_service
    if not conv_id:
        conv_doc = await ai_memory_service.create_conversation(merchant_id=mid)
        conv_id = conv_doc["id"]

    # Save User message
    await ai_memory_service.save_message(
        conversation_id=conv_id,
        merchant_id=mid,
        role="user",
        content=request.message,
    )

    try:
        response = await coordinator.chat(request.message)
        elapsed = (time.perf_counter() - start) * 1000

        # Save Assistant message
        ai_resp_text = response.summary or response.message or "Analysis completed."
        await ai_memory_service.save_message(
            conversation_id=conv_id,
            merchant_id=mid,
            role="assistant",
            content=ai_resp_text,
            agent_used=response.agent or "Coordinator",
            intent="Business Query",
        )

        logger.info(
            "Chat request completed",
            agent=response.agent,
            success=response.success,
            execution_time_ms=round(elapsed, 2),
        )
        return response

    except Exception as exc:
        logger.error("Chat endpoint unhandled exception", error=str(exc))
        from app.services import analytics
        try:
            revenue = await analytics.get_revenue_metrics()
            orders = await analytics.get_order_metrics()
            payments = await analytics.get_payment_metrics()
            analytics_data = {
                "today_revenue": revenue.today,
                "paid_orders": orders.paid_today,
                "payment_success_rate": payments.success_rate,
            }
        except Exception:
            analytics_data = {}

        return ChatResponse(
            success=False,
            agent="Revenue Agent",
            error={
                "type": "LIVE_ANALYTICS_MODE",
                "message": "AI temporarily unavailable. Live analytics generated from MongoDB.",
            },
            analytics=analytics_data,
            metrics=analytics_data,
        )
