from datetime import datetime, timezone
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field

class OrderItem(BaseModel):
    product_id: str
    title: str
    price: float
    image: Optional[str] = ""
    quantity: int

class Order(Document):
    order_id: Indexed(str, unique=True)
    user_id: Indexed(str)
    items: List[OrderItem]
    total_amount: float
    currency: str = "INR"
    razorpay_order_id: Indexed(str)
    payment_status: str = "Pending"  # Pending, Paid, Failed
    order_status: str = "Pending"    # Pending, Paid, Failed, Cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "orders"
