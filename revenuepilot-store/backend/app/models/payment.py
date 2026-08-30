from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field

class Payment(Document):
    payment_id: Indexed(str, unique=True)
    order_id: Indexed(str)
    merchant_id: Indexed(str) = "merch_default"
    razorpay_payment_id: Optional[str] = None  # None for cancellations
    amount: float
    method: str = "unknown"
    status: str = "captured"  # captured, failed, cancelled, pending
    failure_reason: Optional[str] = None
    error_code: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "payments"
