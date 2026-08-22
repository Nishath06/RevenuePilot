from typing import List
from pydantic import BaseModel

class RevenueSummaryOut(BaseModel):
    total_orders: int
    total_revenue: float
    paid_orders: int
    failed_payments: int
    cancelled_orders: int
    pending_orders: int
    payment_success_rate: float
    failure_rate: float
