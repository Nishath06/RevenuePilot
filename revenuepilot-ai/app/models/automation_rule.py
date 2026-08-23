"""
RevenuePilot AI — Automation Rule Model
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class RuleCondition(BaseModel):
    field: str
    operator: str  # 'gt', 'lt', 'eq', 'contains', 'in'
    value: Any


class RuleAction(BaseModel):
    type: str  # 'create_incident', 'retry_payment', 'queue_recovery', 'generate_coupon', 'email_campaign', 'whatsapp_campaign', 'aws_sns', 'aws_eventbridge', 'aws_lambda', 'restock_alert'
    params: Dict[str, Any] = Field(default_factory=dict)


class AutomationRule(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    trigger: str  # e.g. PAYMENT_FAILED, STOCK_BELOW_THRESHOLD, REVENUE_DROP, SCHEDULED_DAILY
    category: str = "Payments"  # Payments, Orders, Inventory, Revenue, Customer, Recovery, Webhooks, Time Schedule
    conditions: List[RuleCondition] = Field(default_factory=list)
    actions: List[RuleAction] = Field(default_factory=list)
    priority: int = 5
    enabled: bool = True
    is_prebuilt: bool = False
    execution_count: int = 0
    last_triggered_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class AutomationRuleCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    trigger: str
    category: str = "Payments"
    conditions: List[RuleCondition] = Field(default_factory=list)
    actions: List[RuleAction] = Field(default_factory=list)
    priority: int = 5
    enabled: bool = True
