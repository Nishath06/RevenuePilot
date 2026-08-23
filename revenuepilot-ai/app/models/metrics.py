"""
RevenuePilot AI — Metrics Data Models
Structured types returned by the analytics service.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RevenueMetrics(BaseModel):
    today: float = 0.0
    yesterday: float = 0.0
    this_week: float = 0.0
    this_month: float = 0.0
    growth_percentage: float = 0.0
    average_order_value: float = 0.0
    currency: str = "INR"


class OrderMetrics(BaseModel):
    total: int = 0
    paid: int = 0
    pending: int = 0
    failed: int = 0
    cancelled: int = 0
    today: int = 0
    this_week: int = 0
    this_month: int = 0
    paid_today: int = 0
    failed_today: int = 0
    cancelled_today: int = 0
    paid_this_week: int = 0
    failed_this_week: int = 0
    cancelled_this_week: int = 0
    paid_this_month: int = 0
    failed_this_month: int = 0
    cancelled_this_month: int = 0


class PaymentMethodCount(BaseModel):
    method: str
    count: int
    amount: float


class PaymentMetrics(BaseModel):
    successful: int = 0
    failed: int = 0
    cancelled: int = 0
    failed_today: int = 0
    cancelled_today: int = 0
    success_rate: float = 0.0
    failure_rate: float = 0.0
    method_breakdown: list[PaymentMethodCount] = Field(default_factory=list)


class ProductStock(BaseModel):
    product_id: str
    title: str
    stock: int
    price: float
    category: str


class SalesRank(BaseModel):
    product_id: str
    title: str
    units_sold: int
    revenue: float
    category: str


class InventoryMetrics(BaseModel):
    low_stock: list[ProductStock] = Field(default_factory=list)
    out_of_stock: list[ProductStock] = Field(default_factory=list)
    best_selling: list[SalesRank] = Field(default_factory=list)
    slow_selling: list[SalesRank] = Field(default_factory=list)
    category_revenue: dict[str, float] = Field(default_factory=dict)


class CustomerProfile(BaseModel):
    user_id: str
    name: str
    email: str
    total_orders: int
    total_spent: float
    last_order_at: datetime | None = None


class CartSnapshot(BaseModel):
    user_id: str
    items_count: int
    subtotal: float
    updated_at: datetime | None = None


class CustomerMetrics(BaseModel):
    repeat_customers: int = 0
    first_time_customers: int = 0
    abandoned_carts: list[CartSnapshot] = Field(default_factory=list)
    inactive_customers: int = 0
    top_customers: list[CustomerProfile] = Field(default_factory=list)


class DashboardSnapshot(BaseModel):
    revenue: RevenueMetrics
    orders: OrderMetrics
    payments: PaymentMetrics
    inventory: InventoryMetrics
    customers: CustomerMetrics
    captured_at: datetime = Field(default_factory=datetime.utcnow)
