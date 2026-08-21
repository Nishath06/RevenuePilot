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

    try:
        response = await coordinator.chat(request.message)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "Chat request completed",
            agent=response.agent,
            execution_time_ms=round(elapsed, 2),
        )
        return response

    except Exception as exc:
        logger.error("Chat endpoint error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(exc)}",
        )
