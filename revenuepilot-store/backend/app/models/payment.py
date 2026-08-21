from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field

class Payment(Document):
    payment_id: Indexed(str, unique=True)
    order_id: Indexed(str)
    razorpay_payment_id: Indexed(str)
    amount: float
    method: str = "card"
    status: str = "captured"  # captured, failed, pending
    failure_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "payments"
