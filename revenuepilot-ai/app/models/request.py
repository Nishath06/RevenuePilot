"""
RevenuePilot AI — Pydantic Request Models
"""
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="Merchant question")
    merchant_id: str | None = Field(None, description="Optional merchant identifier")
    conversation_id: str | None = Field(None, description="Optional persistent conversation identifier")
    context: dict | None = Field(None, description="Optional context payload")
