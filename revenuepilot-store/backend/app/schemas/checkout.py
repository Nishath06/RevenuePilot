from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.models.order import OrderItem

class CreateOrderRequest(BaseModel):
    items: Optional[List[OrderItem]] = None

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class RazorpayOrderResponse(BaseModel):
    order_id: str
    razorpay_order_id: str
    amount: int
    currency: str
    key: str

class OrderOut(BaseModel):
    order_id: str
    user_id: str
    items: List[OrderItem]
    total_amount: float
    currency: str
    razorpay_order_id: str
    payment_status: str
    order_status: str
    created_at: datetime
