"""
RevenuePilot AI — Merchant Service
Higher-level service consumed by API routes.
Wraps analytics + cache + recommendation logic.
"""
from __future__ import annotations

from app.core.logging import get_logger
from app.models.metrics import (
    CustomerMetrics,
    DashboardSnapshot,
    InventoryMetrics,
    OrderMetrics,
    PaymentMetrics,
    RevenueMetrics,
)
from app.models.response import RecoveryResponse, PromptChip
from app.services import analytics
from app.services.cache import cache

logger = get_logger(__name__)

_CACHE_TTL = 180  # 3 minutes for merchant data


async def get_today_snapshot() -> DashboardSnapshot:
    key = "snapshot:today"
    cached = await cache.get(key)
    if cached:
        return cached

    snapshot = DashboardSnapshot(
        revenue=await analytics.get_revenue_metrics(),
        orders=await analytics.get_order_metrics(),
        payments=await analytics.get_payment_metrics(),
        inventory=await analytics.get_inventory_metrics(),
        customers=await analytics.get_customer_metrics(),
    )
    await cache.set(key, snapshot, ttl=_CACHE_TTL)
    return snapshot


async def get_revenue_metrics() -> RevenueMetrics:
    key = "metrics:revenue"
    cached = await cache.get(key)
    if cached:
        return cached
    result = await analytics.get_revenue_metrics()
    await cache.set(key, result, ttl=_CACHE_TTL)
    return result


async def get_order_metrics() -> OrderMetrics:
    key = "metrics:orders"
    cached = await cache.get(key)
    if cached:
        return cached
    result = await analytics.get_order_metrics()
    await cache.set(key, result, ttl=_CACHE_TTL)
    return result


async def get_payment_metrics() -> PaymentMetrics:
    key = "metrics:payments"
    cached = await cache.get(key)
    if cached:
        return cached
    result = await analytics.get_payment_metrics()
    await cache.set(key, result, ttl=_CACHE_TTL)
    return result


async def get_inventory_metrics() -> InventoryMetrics:
    key = "metrics:inventory"
    cached = await cache.get(key)
    if cached:
        return cached
    result = await analytics.get_inventory_metrics()
    await cache.set(key, result, ttl=_CACHE_TTL)
    return result


async def get_customer_metrics() -> CustomerMetrics:
    key = "metrics:customers"
    cached = await cache.get(key)
    if cached:
        return cached
    result = await analytics.get_customer_metrics()
    await cache.set(key, result, ttl=_CACHE_TTL)
    return result


async def get_recovery_data() -> RecoveryResponse:
    """Build recovery payload: failed payments + abandoned carts + messages."""
    payment_col_data = await analytics.get_payment_metrics()
    carts = await analytics.abandoned_carts(limit=10)
    top_customers = await analytics.top_customers(limit=5)

    # Build WhatsApp recovery messages for abandoned carts
    whatsapp: list[str] = []
    for cart in carts[:5]:
        msg = (
            f"Hi! 👋 You left items worth ₹{cart.subtotal:.0f} in your cart. "
            f"Complete your purchase now and get FREE shipping! 🛒"
        )
        whatsapp.append(msg)

    # Build email recovery messages
    emails: list[str] = []
    for cart in carts[:5]:
        emails.append(
            f"Subject: You left something behind!\n\n"
            f"We noticed you left {cart.items_count} item(s) worth ₹{cart.subtotal:.0f} "
            f"in your cart. Come back and complete your order before they sell out!"
        )

    failed_payments_raw = await analytics.col_count("payments", {"status": "failed"})

    return RecoveryResponse(
        failed_payments=[{"count": failed_payments_raw, "note": "See /insights/payments for full breakdown"}],
        abandoned_carts=[c.model_dump() for c in carts],
        whatsapp_messages=whatsapp,
        email_messages=emails,
        priority_customers=[c.model_dump() for c in top_customers],
        total_recoverable_amount=sum(c.subtotal for c in carts),
    )


def get_merchant_prompts() -> list[PromptChip]:
    return [
        PromptChip(label="Today's Revenue", query="What is today's revenue?", category="Revenue", icon="💰"),
        PromptChip(label="Weekly Sales", query="Show me this week's sales summary.", category="Revenue", icon="📈"),
        PromptChip(label="Monthly Revenue", query="What is this month's revenue?", category="Revenue", icon="📅"),
        PromptChip(label="Revenue Growth", query="How much has revenue grown compared to yesterday?", category="Revenue", icon="🚀"),
        PromptChip(label="Failed Payments", query="How many payments failed today?", category="Payments", icon="❌"),
        PromptChip(label="Payment Methods", query="What is the payment method breakdown?", category="Payments", icon="💳"),
        PromptChip(label="Low Stock Products", query="Which products are running low on stock?", category="Inventory", icon="⚠️"),
        PromptChip(label="Out of Stock", query="Which products are out of stock?", category="Inventory", icon="🚫"),
        PromptChip(label="Best Selling Products", query="What are the best selling products?", category="Inventory", icon="🏆"),
        PromptChip(label="Abandoned Carts", query="How many customers abandoned their carts?", category="Recovery", icon="🛒"),
        PromptChip(label="Top Customers", query="Who are my top customers by revenue?", category="Customers", icon="👑"),
        PromptChip(label="Repeat Customers", query="How many repeat customers do I have?", category="Customers", icon="🔄"),
        PromptChip(label="Revenue Forecast", query="Based on current trends, what is the revenue outlook?", category="Insights", icon="🔮"),
        PromptChip(label="Recovery Opportunities", query="What are my biggest recovery opportunities right now?", category="Recovery", icon="💡"),
    ]
