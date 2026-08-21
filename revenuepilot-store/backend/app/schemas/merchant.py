from typing import List
from pydantic import BaseModel

class RevenueSummaryOut(BaseModel):
    total_orders: int
    total_revenue: float
    paid_orders: int
    failed_payments: int
    pending_orders: int
