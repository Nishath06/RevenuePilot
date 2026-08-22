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

_CACHE_TTL = 10  # 10 seconds — live payment data must be near-real-time


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


async def get_revenue_metrics(fresh: bool = False) -> RevenueMetrics:
    key = "metrics:revenue"
    if not fresh:
        cached = await cache.get(key)
        if cached:
            return cached
    result = await analytics.get_revenue_metrics()
    await cache.set(key, result, ttl=_CACHE_TTL)
    return result


async def get_order_metrics(fresh: bool = False) -> OrderMetrics:
    key = "metrics:orders"
    if not fresh:
        cached = await cache.get(key)
        if cached:
            return cached
    result = await analytics.get_order_metrics()
    await cache.set(key, result, ttl=_CACHE_TTL)
    return result


async def get_payment_metrics(fresh: bool = False) -> PaymentMetrics:
    key = "metrics:payments"
    if not fresh:
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
    """Build recovery payload: failed payments + cancelled payments + abandoned carts + AI recovery messages."""
    orders_col = analytics.get_collection("orders")
    users_col = analytics.get_collection("users")
    payments_col = analytics.get_collection("payments")

    # 1. Fetch Failed Orders (up to 10)
    failed_order_docs = await orders_col.find({"payment_status": "Failed"}).sort("created_at", -1).limit(10).to_list(10)
    failed_items = []
    for o in failed_order_docs:
        user_doc = await users_col.find_one({"_id": o.get("user_id")}) or {}
        pay_doc = await payments_col.find_one({"order_id": o.get("order_id")}) or {}
        customer_name = user_doc.get("name", "Customer")
        reason = pay_doc.get("failure_reason") or "Payment execution failed"
        amount = o.get("total_amount", 0.0)

        wa_msg = (
            f"Hi {customer_name}! 👋 Your payment of ₹{amount:.0f} failed due to '{reason}'. "
            f"Click here to retry your order with 1-click checkout: https://store.revenuepilot.dev/checkout/retry?order={o.get('order_id')}"
        )
        email_msg = (
            f"Subject: Payment Failed — Complete Your Order {o.get('order_id')}\n\n"
            f"Hi {customer_name},\n\nWe noticed your payment of ₹{amount:.0f} for order {o.get('order_id')} "
            f"failed ({reason}). Don't worry! Your items are reserved for the next 24 hours.\n\n"
            f"Retry Payment: https://store.revenuepilot.dev/checkout/retry?order={o.get('order_id')}"
        )
        failed_items.append({
            "order_id": o.get("order_id"),
            "customer_name": customer_name,
            "customer_email": user_doc.get("email", ""),
            "customer_phone": user_doc.get("phone", ""),
            "amount": amount,
            "failure_reason": reason,
            "error_code": pay_doc.get("error_code") or "FAILED",
            "created_at": o.get("created_at").isoformat() if hasattr(o.get("created_at"), "isoformat") else str(o.get("created_at")),
            "whatsapp_message": wa_msg,
            "email_message": email_msg,
            "type": "failed"
        })

    # 2. Fetch Cancelled Orders (up to 10)
    cancelled_order_docs = await orders_col.find({"payment_status": "Cancelled"}).sort("created_at", -1).limit(10).to_list(10)
    cancelled_items = []
    for o in cancelled_order_docs:
        user_doc = await users_col.find_one({"_id": o.get("user_id")}) or {}
        customer_name = user_doc.get("name", "Customer")
        amount = o.get("total_amount", 0.0)

        wa_msg = (
            f"Hi {customer_name}! 👋 We saw you cancelled your purchase of ₹{amount:.0f}. "
            f"Use code RECOVER10 to get 10% OFF if you finish your order now!"
        )
        email_msg = (
            f"Subject: Did you forget something? Here's 10% off!\n\n"
            f"Hi {customer_name},\n\nYou left your order worth ₹{amount:.0f} behind. "
            f"Complete checkout with code RECOVER10 for 10% off your purchase."
        )
        cancelled_items.append({
            "order_id": o.get("order_id"),
            "customer_name": customer_name,
            "customer_email": user_doc.get("email", ""),
            "customer_phone": user_doc.get("phone", ""),
            "amount": amount,
            "failure_reason": "Customer cancelled checkout",
            "created_at": o.get("created_at").isoformat() if hasattr(o.get("created_at"), "isoformat") else str(o.get("created_at")),
            "whatsapp_message": wa_msg,
            "email_message": email_msg,
            "type": "cancelled"
        })

    # 3. Fetch Abandoned Carts
    carts = await analytics.abandoned_carts(limit=10)
    abandoned_cart_list = []
    whatsapp_msgs = []
    email_msgs = []
    for cart in carts:
        user_doc = await users_col.find_one({"_id": cart.user_id}) or {}
        customer_name = user_doc.get("name", f"User {cart.user_id[-6:] if cart.user_id else 'Guest'}")
        
        wa_msg = (
            f"Hi {customer_name}! 👋 You left {cart.items_count} item(s) worth ₹{cart.subtotal:.0f} in your cart. "
            f"Complete your purchase now and get FREE shipping! 🛒"
        )
        email_msg = (
            f"Subject: You left something behind!\n\n"
            f"Hi {customer_name},\n\nWe noticed you left {cart.items_count} item(s) worth ₹{cart.subtotal:.0f} "
            f"in your cart. Come back and complete your order before they sell out!"
        )
        whatsapp_msgs.append(wa_msg)
        email_msgs.append(email_msg)

        abandoned_cart_list.append({
            "user_id": cart.user_id,
            "customer_name": customer_name,
            "items_count": cart.items_count,
            "subtotal": cart.subtotal,
            "updated_at": cart.updated_at.isoformat() if hasattr(cart.updated_at, "isoformat") else str(cart.updated_at),
            "whatsapp_message": wa_msg,
            "email_message": email_msg,
            "type": "abandoned"
        })

    top_customers = await analytics.top_customers(limit=5)
    total_recoverable = sum(item["amount"] for item in failed_items) + sum(item["amount"] for item in cancelled_items) + sum(c.subtotal for c in carts)

    return RecoveryResponse(
        failed_payments=failed_items + cancelled_items,
        abandoned_carts=abandoned_cart_list,
        whatsapp_messages=whatsapp_msgs,
        email_messages=email_msgs,
        priority_customers=[c.model_dump() for c in top_customers],
        total_recoverable_amount=round(total_recoverable, 2),
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
