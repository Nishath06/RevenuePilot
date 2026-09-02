"""
RevenuePilot AI — Pydantic Response Models
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatErrorDetail(BaseModel):
    type: str = Field(..., description="Error type code, e.g. OPENAI_QUOTA_EXCEEDED")
    message: str = Field(..., description="User friendly error message")


class SourceAttribution(BaseModel):
    collections_used: list[str] = Field(default_factory=list, description="MongoDB collections queried")
    documents_analyzed: int = Field(default=0, description="Total documents scanned")
    timestamp: str = Field(default="", description="Snapshot ISO timestamp")


class CoordinatorMetadata(BaseModel):
    intent_classified: str = Field(default="Revenue Analysis", description="Detected merchant query intent")
    selected_agent: str = Field(default="Revenue Agent", description="Selected specialist agent")
    tools_executed: list[str] = Field(default_factory=list, description="Tools invoked during analysis")
    confidence: str = Field(default="High", description="Classifier confidence score")
    execution_time_ms: float = Field(default=0.0, description="Processing execution time in milliseconds")


class ChatChart(BaseModel):
    type: str = Field(..., description="Chart type code: revenue_trend | payment_distribution | top_products | recovery_funnel | inventory_health")
    title: str = Field(..., description="Chart title")
    data: list[dict[str, Any]] = Field(default_factory=list, description="Chart dataset entries")


class ChatResponse(BaseModel):
    success: bool = Field(default=True, description="Whether the request succeeded")
    agent: str = Field(default="Revenue Agent", description="Name of the specialist agent that responded")
    answer: str | None = Field(default=None, description="Natural-language answer in Markdown format")
    summary: str | None = Field(default=None, description="Executive summary")
    insight: str | None = Field(default=None, description="Detailed business insight")
    metrics: dict[str, Any] = Field(default_factory=dict, description="Live business metrics")
    recommendations: list[str] = Field(default_factory=list, description="Actionable recommendations")
    analytics: dict[str, Any] = Field(default_factory=dict, description="Live MongoDB analytics snapshot")
    source_attribution: SourceAttribution | None = Field(default=None, description="Data source metadata")
    coordinator_metadata: CoordinatorMetadata | None = Field(default=None, description="Coordinator transparency metadata")
    chart: ChatChart | None = Field(default=None, description="Embedded visual chart payload")
    inventory_card: dict[str, Any] | None = Field(default=None, description="Detailed inventory domain intelligence card")
    payment_card: dict[str, Any] | None = Field(default=None, description="Detailed payment domain intelligence card")
    customer_card: dict[str, Any] | None = Field(default=None, description="Detailed customer domain intelligence card")
    recovery_card: dict[str, Any] | None = Field(default=None, description="Detailed recovery domain intelligence card")
    error: ChatErrorDetail | None = Field(default=None, description="Structured error details if success is false")
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
    cancelled_orders: list[dict[str, Any]] = Field(default_factory=list)
    abandoned_carts: list[dict[str, Any]] = Field(default_factory=list)
    whatsapp_messages: list[str] = Field(default_factory=list)
    email_messages: list[str] = Field(default_factory=list)
    priority_customers: list[dict[str, Any]] = Field(default_factory=list)
    total_recoverable_amount: float = 0.0
    failed_count: int = 0
    cancelled_count: int = 0
    abandoned_count: int = 0
    recovered_count: int = 0
    total_candidates_count: int = 0
    success_rate_percentage: float = 0.0


class HealthResponse(BaseModel):
    status: str
    mongodb: str
    llm_provider: str = Field(default="grok", description="Active LLM provider name")
    llm_status: str = Field(default="connected", description="LLM provider status")
    analytics_engine: str = Field(default="ready", description="Analytics engine readiness status")
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
