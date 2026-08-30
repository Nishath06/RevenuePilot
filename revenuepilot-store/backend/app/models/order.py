from datetime import datetime, timezone
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field

class OrderItem(BaseModel):
    product_id: str = "prod_unknown"
    title: Optional[str] = "Product Item"
    price: float = 0.0
    image: Optional[str] = ""
    quantity: int = 1

class PaymentEvent(BaseModel):
    status: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reason: Optional[str] = None
    error_code: Optional[str] = None

class Order(Document):
    order_id: Indexed(str, unique=True)
    user_id: Indexed(str)
    merchant_id: Indexed(str) = "merch_default"
    items: List[OrderItem]
    total_amount: float
    currency: str = "INR"
    razorpay_order_id: Indexed(str)
    payment_status: str = "Pending"  # Pending, Paid, Failed, Cancelled
    order_status: str = "Pending"    # Pending, Paid, Failed, Cancelled
    payment_events: List[PaymentEvent] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "orders"
