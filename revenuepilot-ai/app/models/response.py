"""
RevenuePilot AI — Pydantic Response Models
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatResponse(BaseModel):
    agent: str = Field(..., description="Name of the specialist agent that responded")
    answer: str = Field(..., description="Natural-language answer")
    metrics: dict[str, Any] = Field(default_factory=dict, description="Live business metrics")
    recommendations: list[str] = Field(default_factory=list, description="Actionable recommendations")
    execution_time_ms: float | None = None


class InsightResponse(BaseModel):
    period: str
    revenue: dict[str, Any] = Field(default_factory=dict)
    orders: dict[str, Any] = Field(default_factory=dict)
    payments: dict[str, Any] = Field(default_factory=dict)
    customers: dict[str, Any] = Field(default_factory=dict)
    recommendations: list[str] = Field(default_factory=list)


class RecoveryResponse(BaseModel):
    failed_payments: list[dict[str, Any]] = Field(default_factory=list)
    abandoned_carts: list[dict[str, Any]] = Field(default_factory=list)
    whatsapp_messages: list[str] = Field(default_factory=list)
    email_messages: list[str] = Field(default_factory=list)
    priority_customers: list[dict[str, Any]] = Field(default_factory=list)
    total_recoverable_amount: float = 0.0


class HealthResponse(BaseModel):
    status: str
    mongodb: str
    ai_ready: bool
    version: str
    environment: str
    uptime_seconds: float | None = None


class PromptChip(BaseModel):
    label: str
    query: str
    category: str
    icon: str = "💡"


class PromptsResponse(BaseModel):
    prompts: list[PromptChip]
    total: int
