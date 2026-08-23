"""
RevenuePilot AI — Event & Execution Models
"""
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class EventRecord(BaseModel):
    event_id: str
    event_type: str  # e.g. PAYMENT_FAILED, LOW_STOCK, REVENUE_DROP
    source: str = "revenuepilot-store"
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    payload: Dict[str, Any] = Field(default_factory=dict)
    severity: str = "info"  # info, warning, critical
    status: str = "processed"  # processed, retrying, failed


class ExecutionLog(BaseModel):
    execution_id: str
    automation_id: str
    rule_name: str
    trigger: str
    event_id: Optional[str] = None
    status: str = "success"  # success, failed
    result_detail: str = ""
    duration_ms: float = 0.0
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    aws_publish_status: str = "skipped"  # skipped, published, failed_fallback_local
    mongo_write_status: str = "success"
    retry_count: int = 0
