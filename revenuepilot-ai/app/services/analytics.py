"""
RevenuePilot AI — Analytics Service
All business metrics come from MongoDB aggregations.
No business logic inside routes. No LLM calculations.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.logging import get_logger
from app.db.mongodb import get_collection
from app.models.metrics import (
    CartSnapshot,
    CustomerMetrics,
    CustomerProfile,
    InventoryMetrics,
    OrderMetrics,
    PaymentMetrics,
    PaymentMethodCount,
    ProductStock,
    RevenueMetrics,
    SalesRank,
)

logger = get_logger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _start_of_day(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# Revenue Metrics
# ─────────────────────────────────────────────────────────────────────────────

async def revenue_today() -> float:
    """Sum of paid order totals created today (UTC). Handles both tz-aware and naive stored datetimes."""
    import time
    t0 = time.monotonic()
    now = _utc_now()
    start_aware = _start_of_day(now)
    start_naive = start_aware.replace(tzinfo=None)
    col = get_collection("orders")

    # Try tz-aware first
    pipeline = [
        {"$match": {"payment_status": "Paid", "created_at": {"$gte": start_aware}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "count": {"$sum": 1}}},
    ]
    result = await col.aggregate(pipeline).to_list(1)

    # If nothing found, try naive datetime (MongoDB stored without tz)
    if not result:
        pipeline[0]["$match"]["created_at"] = {"$gte": start_naive}
        result = await col.aggregate(pipeline).to_list(1)

    revenue = result[0]["total"] if result else 0.0
    count = result[0]["count"] if result else 0
    elapsed = round((time.monotonic() - t0) * 1000, 1)
    logger.info("revenue_today", revenue=revenue, paid_orders=count,
                start=str(start_aware), elapsed_ms=elapsed)
    return revenue


async def revenue_yesterday() -> float:
    """Sum of paid order totals from yesterday (UTC)."""
    now = _utc_now()
    today_start = _start_of_day(now)
    yesterday_start = today_start - timedelta(days=1)
    col = get_collection("orders")
    pipeline = [
        {
            "$match": {
                "payment_status": "Paid",
                "created_at": {"$gte": yesterday_start, "$lt": today_start},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ]
    result = await col.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0.0


async def revenue_this_week() -> float:
    """Revenue since Monday 00:00 UTC of the current ISO week."""
    now = _utc_now()
    week_start = _start_of_day(now) - timedelta(days=now.weekday())
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid", "created_at": {"$gte": week_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ]
    result = await col.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0.0


async def revenue_this_month() -> float:
    """Revenue since the 1st of the current calendar month (UTC)."""
    now = _utc_now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid", "created_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ]
    result = await col.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0.0


async def growth_percentage() -> float:
    """Day-over-day revenue growth percentage (today vs yesterday)."""
    today = await revenue_today()
    yesterday = await revenue_yesterday()
    if yesterday == 0:
        return 100.0 if today > 0 else 0.0
    return round(((today - yesterday) / yesterday) * 100, 2)


async def average_order_value() -> float:
    """Average value of paid orders all-time."""
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid"}},
        {"$group": {"_id": None, "avg": {"$avg": "$total_amount"}}},
    ]
    result = await col.aggregate(pipeline).to_list(1)
    return round(result[0]["avg"], 2) if result else 0.0


async def get_revenue_metrics() -> RevenueMetrics:
    """Aggregate all revenue metrics in a single structured response."""
    return RevenueMetrics(
        today=await revenue_today(),
        yesterday=await revenue_yesterday(),
        this_week=await revenue_this_week(),
        this_month=await revenue_this_month(),
        growth_percentage=await growth_percentage(),
        average_order_value=await average_order_value(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Order Metrics
# ─────────────────────────────────────────────────────────────────────────────

async def total_orders() -> int:
    col = get_collection("orders")
    return await col.count_documents({})


async def paid_orders() -> int:
    col = get_collection("orders")
    return await col.count_documents({"payment_status": "Paid"})


async def paid_orders_today() -> int:
    """Count paid orders created today — handles both tz-aware and naive datetimes."""
    now = _utc_now()
    start_aware = _start_of_day(now)
    start_naive = start_aware.replace(tzinfo=None)
    col = get_collection("orders")
    count = await col.count_documents({"payment_status": "Paid", "created_at": {"$gte": start_aware}})
    if count == 0:
        count = await col.count_documents({"payment_status": "Paid", "created_at": {"$gte": start_naive}})
    logger.info("paid_orders_today", count=count)
    return count


async def pending_orders() -> int:
    col = get_collection("orders")
    return await col.count_documents({"payment_status": "Pending"})


async def failed_orders() -> int:
    """Count all-time orders with Failed payment status."""
    col = get_collection("orders")
    return await col.count_documents({"payment_status": "Failed"})


async def cancelled_orders() -> int:
    """Count all-time orders with Cancelled payment status."""
    col = get_collection("orders")
    return await col.count_documents({"payment_status": "Cancelled"})


async def _today_order_count(status: str) -> int:
    """Count orders of a given payment_status created today. Handles tz-aware/naive."""
    now = _utc_now()
    start_aware = _start_of_day(now)
    start_naive = start_aware.replace(tzinfo=None)
    col = get_collection("orders")
    count = await col.count_documents({"payment_status": status, "created_at": {"$gte": start_aware}})
    if count == 0:
        count = await col.count_documents({"payment_status": status, "created_at": {"$gte": start_naive}})
    return count


async def failed_orders_today() -> int:
    return await _today_order_count("Failed")


async def cancelled_orders_today() -> int:
    return await _today_order_count("Cancelled")

async def orders_today() -> int:
    """Count all orders created today regardless of status."""
    now = _utc_now()
    start_aware = _start_of_day(now)
    start_naive = start_aware.replace(tzinfo=None)
    col = get_collection("orders")
    count = await col.count_documents({"created_at": {"$gte": start_aware}})
    if count == 0:
        count = await col.count_documents({"created_at": {"$gte": start_naive}})
    return count


async def orders_this_week() -> int:
    now = _utc_now()
    week_start = _start_of_day(now) - timedelta(days=now.weekday())
    col = get_collection("orders")
    count = await col.count_documents({"created_at": {"$gte": week_start}})
    if count == 0:
        count = await col.count_documents({"created_at": {"$gte": week_start.replace(tzinfo=None)}})
    return count


async def get_order_metrics() -> OrderMetrics:
    import time
    t0 = time.monotonic()
    total = await total_orders()
    paid = await paid_orders()
    pending = await pending_orders()
    failed = await failed_orders()
    cancelled = await cancelled_orders()
    today = await orders_today()
    paid_today = await paid_orders_today()
    failed_today = await failed_orders_today()
    cancelled_today = await cancelled_orders_today()
    this_week = await orders_this_week()
    elapsed = round((time.monotonic() - t0) * 1000, 1)
    logger.info("get_order_metrics",
                total=total, paid_today=paid_today, failed_today=failed_today,
                cancelled_today=cancelled_today, pending=pending, elapsed_ms=elapsed)
    return OrderMetrics(
        total=total,
        paid=paid_today,
        pending=pending,
        failed=failed,
        cancelled=cancelled,
        today=today,
        this_week=this_week,
        paid_today=paid_today,
        failed_today=failed_today,
        cancelled_today=cancelled_today,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Payment Metrics
# ─────────────────────────────────────────────────────────────────────────────

async def col_count(collection_name: str, query: dict) -> int:
    """Helper to count documents."""
    col = get_collection(collection_name)
    return await col.count_documents(query)


async def successful_payments() -> int:
    """Count all-time captured payments."""
    col = get_collection("payments")
    return await col.count_documents({"status": "captured"})


async def failed_payments() -> int:
    """Count all-time failed payments."""
    col = get_collection("payments")
    return await col.count_documents({"status": "failed"})


async def failed_payments_today() -> int:
    """Count today's failed payments."""
    now = _utc_now()
    start = _start_of_day(now)
    col = get_collection("payments")
    # Try tz-aware first, fall back to naive
    count = await col.count_documents({"status": "failed", "created_at": {"$gte": start}})
    if count == 0:
        count = await col.count_documents({"status": "failed", "created_at": {"$gte": start.replace(tzinfo=None)}})
    return count


async def cancelled_payments_today() -> int:
    """Count today's cancelled payments."""
    now = _utc_now()
    start = _start_of_day(now)
    col = get_collection("payments")
    count = await col.count_documents({"status": "cancelled", "created_at": {"$gte": start}})
    if count == 0:
        count = await col.count_documents({"status": "cancelled", "created_at": {"$gte": start.replace(tzinfo=None)}})
    return count


async def recovery_candidates() -> dict:
    """Retrieve all candidates for revenue recovery: failed, cancelled, and abandoned carts."""
    orders_col = get_collection("orders")
    failed = await orders_col.find({"payment_status": "Failed"}).sort("created_at", -1).to_list(50)
    cancelled = await orders_col.find({"payment_status": "Cancelled"}).sort("created_at", -1).to_list(50)
    carts = await abandoned_carts(limit=50)
    return {
        "failed_orders_count": len(failed),
        "cancelled_orders_count": len(cancelled),
        "abandoned_carts_count": len(carts),
        "total_candidates": len(failed) + len(cancelled) + len(carts),
    }



async def payment_success_rate() -> float:
    """Compute all-time payment success rate."""
    col = get_collection("payments")
    total = await col.count_documents({})
    success = await successful_payments()
    if total == 0:
        # Fallback: derive from orders if no payments collection entries
        orders_col = get_collection("orders")
        paid = await orders_col.count_documents({"payment_status": "Paid"})
        total_orders = await orders_col.count_documents({})
        if total_orders == 0:
            return 0.0
        rate = round((paid / total_orders) * 100, 2)
        logger.info("payment_success_rate derived from orders", rate=rate, paid=paid, total=total_orders)
        return rate
    rate = round((success / total) * 100, 2)
    logger.info("payment_success_rate", rate=rate, success=success, total=total)
    return rate


async def payment_method_breakdown() -> list[PaymentMethodCount]:
    """Group payment counts by method."""
    col = get_collection("payments")
    pipeline = [
        {
            "$group": {
                "_id": "$method",
                "count": {"$sum": 1},
                "amount": {"$sum": "$amount"},
            }
        },
        {"$sort": {"count": -1}},
    ]
    result = await col.aggregate(pipeline).to_list(50)
    return [
        PaymentMethodCount(
            method=r["_id"] or "unknown",
            count=r["count"],
            amount=r["amount"],
        )
        for r in result
    ]


async def cancelled_payments() -> int:
    """Count all-time cancelled payments."""
    col = get_collection("payments")
    return await col.count_documents({"status": "cancelled"})


async def failure_rate() -> float:
    """failure_rate = failed / (successful + failed), cancellations excluded."""
    success = await successful_payments()
    failed = await failed_payments()
    terminal = success + failed
    return round((failed / terminal) * 100, 2) if terminal > 0 else 0.0


async def payment_failure_rate() -> float:
    """payment_failure_rate = failed / (successful + failed), cancellations excluded."""
    return await failure_rate()


async def payment_cancellation_rate() -> float:
    """payment_cancellation_rate = cancelled / (successful + failed + cancelled)."""
    success = await successful_payments()
    failed = await failed_payments()
    cancelled = await cancelled_payments()
    total_attempts = success + failed + cancelled
    return round((cancelled / total_attempts) * 100, 2) if total_attempts > 0 else 0.0


async def recovery_value() -> float:
    """Total monetary value of all recoverable candidates (Failed + Cancelled + Abandoned Carts)."""
    orders_col = get_collection("orders")
    failed_docs = await orders_col.find({"payment_status": "Failed"}).to_list(1000)
    cancelled_docs = await orders_col.find({"payment_status": "Cancelled"}).to_list(1000)
    carts = await abandoned_carts(limit=1000)

    failed_val = sum(o.get("total_amount", 0) for o in failed_docs)
    cancelled_val = sum(o.get("total_amount", 0) for o in cancelled_docs)
    cart_val = sum(c.total_value for c in carts)

    return round(failed_val + cancelled_val + cart_val, 2)



async def get_payment_metrics() -> PaymentMetrics:
    import time
    t0 = time.monotonic()
    col = get_collection("payments")
    total = await col.count_documents({})
    success = await successful_payments()
    failed = await failed_payments()
    cancelled = await cancelled_payments()

    # If payments collection empty, derive from orders (webhook-only stores)
    if total == 0:
        orders_col = get_collection("orders")
        paid = await orders_col.count_documents({"payment_status": "Paid"})
        fail_o = await orders_col.count_documents({"payment_status": "Failed"})
        cancel_o = await orders_col.count_documents({"payment_status": "Cancelled"})
        terminal = paid + fail_o
        rate = round((paid / terminal) * 100, 2) if terminal > 0 else 0.0
        f_rate = round((fail_o / terminal) * 100, 2) if terminal > 0 else 0.0
        elapsed = round((time.monotonic() - t0) * 1000, 1)
        logger.info("get_payment_metrics (orders fallback)",
                    success_rate=rate, paid=paid, failed=fail_o, cancelled=cancel_o, elapsed_ms=elapsed)
        return PaymentMetrics(
            successful=paid,
            failed=fail_o,
            cancelled=cancel_o,
            failed_today=await failed_payments_today(),
            cancelled_today=await _today_order_count("Cancelled"),
            success_rate=rate,
            failure_rate=f_rate,
            method_breakdown=await payment_method_breakdown(),
        )

    terminal = success + failed
    rate = round((success / terminal) * 100, 2) if terminal > 0 else 0.0
    f_rate = round((failed / terminal) * 100, 2) if terminal > 0 else 0.0
    elapsed = round((time.monotonic() - t0) * 1000, 1)
    logger.info("get_payment_metrics",
                success_rate=rate, failure_rate=f_rate, successful=success,
                failed=failed, cancelled=cancelled, total=total, elapsed_ms=elapsed)
    return PaymentMetrics(
        successful=success,
        failed=failed,
        cancelled=cancelled,
        failed_today=await failed_payments_today(),
        cancelled_today=await _today_order_count("Cancelled"),
        success_rate=rate,
        failure_rate=f_rate,
        method_breakdown=await payment_method_breakdown(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Inventory Metrics
# ─────────────────────────────────────────────────────────────────────────────

_LOW_STOCK_THRESHOLD = 10


async def low_stock_products() -> list[ProductStock]:
    col = get_collection("products")
    cursor = col.find({"stock": {"$gt": 0, "$lte": _LOW_STOCK_THRESHOLD}}).sort("stock", 1).limit(20)
    docs = await cursor.to_list(20)
    return [
        ProductStock(
            product_id=d.get("product_id", str(d["_id"])),
            title=d.get("title", "Unknown"),
            stock=d.get("stock", 0),
            price=d.get("price", 0.0),
            category=d.get("category", ""),
        )
        for d in docs
    ]


async def out_of_stock_products() -> list[ProductStock]:
    col = get_collection("products")
    cursor = col.find({"stock": {"$lte": 0}}).limit(20)
    docs = await cursor.to_list(20)
    return [
        ProductStock(
            product_id=d.get("product_id", str(d["_id"])),
            title=d.get("title", "Unknown"),
            stock=0,
            price=d.get("price", 0.0),
            category=d.get("category", ""),
        )
        for d in docs
    ]


async def best_selling_products(limit: int = 10) -> list[SalesRank]:
    """Rank products by units sold derived from paid order items."""
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid"}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.product_id",
                "title": {"$first": "$items.title"},
                "units_sold": {"$sum": "$items.quantity"},
                "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
            }
        },
        {"$sort": {"units_sold": -1}},
        {"$limit": limit},
    ]
    result = await col.aggregate(pipeline).to_list(limit)
    return [
        SalesRank(
            product_id=r["_id"],
            title=r["title"],
            units_sold=r["units_sold"],
            revenue=round(r["revenue"], 2),
            category="",
        )
        for r in result
    ]


async def slow_selling_products(limit: int = 10) -> list[SalesRank]:
    """Products with the fewest units sold (but at least 1 sale)."""
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid"}},
        {"$unwind": "$items"},
        {
            "$group": {
                "_id": "$items.product_id",
                "title": {"$first": "$items.title"},
                "units_sold": {"$sum": "$items.quantity"},
                "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
            }
        },
        {"$sort": {"units_sold": 1}},
        {"$limit": limit},
    ]
    result = await col.aggregate(pipeline).to_list(limit)
    return [
        SalesRank(
            product_id=r["_id"],
            title=r["title"],
            units_sold=r["units_sold"],
            revenue=round(r["revenue"], 2),
            category="",
        )
        for r in result
    ]


async def category_revenue() -> dict[str, float]:
    """Revenue per product category from paid orders."""
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid"}},
        {"$unwind": "$items"},
        {
            "$lookup": {
                "from": "products",
                "localField": "items.product_id",
                "foreignField": "product_id",
                "as": "product",
            }
        },
        {"$unwind": {"path": "$product", "preserveNullAndEmptyArrays": True}},
        {
            "$group": {
                "_id": {"$ifNull": ["$product.category", "Uncategorized"]},
                "revenue": {
                    "$sum": {"$multiply": ["$items.price", "$items.quantity"]}
                },
            }
        },
        {"$sort": {"revenue": -1}},
    ]
    result = await col.aggregate(pipeline).to_list(50)
    return {r["_id"]: round(r["revenue"], 2) for r in result}


async def get_inventory_metrics() -> InventoryMetrics:
    return InventoryMetrics(
        low_stock=await low_stock_products(),
        out_of_stock=await out_of_stock_products(),
        best_selling=await best_selling_products(),
        slow_selling=await slow_selling_products(),
        category_revenue=await category_revenue(),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Customer Metrics
# ─────────────────────────────────────────────────────────────────────────────

async def repeat_customers() -> int:
    """Users who have more than 1 paid order."""
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid"}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$count": "total"},
    ]
    result = await col.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


async def first_time_customers() -> int:
    """Users with exactly 1 paid order."""
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid"}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$match": {"count": 1}},
        {"$count": "total"},
    ]
    result = await col.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0


async def abandoned_carts(limit: int = 20) -> list[CartSnapshot]:
    """Carts with items that have no corresponding paid order placed recently."""
    col = get_collection("carts")
    cutoff = _utc_now() - timedelta(hours=1)
    cursor = col.find(
        {"items": {"$exists": True, "$ne": []}, "updated_at": {"$lt": cutoff}}
    ).sort("subtotal", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return [
        CartSnapshot(
            user_id=d.get("user_id", ""),
            items_count=len(d.get("items", [])),
            subtotal=d.get("subtotal", 0.0),
            updated_at=d.get("updated_at"),
        )
        for d in docs
    ]


async def inactive_customers(days: int = 30) -> int:
    """Users who haven't placed any order in the past `days` days."""
    cutoff = _utc_now() - timedelta(days=days)
    orders_col = get_collection("orders")
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "payment_status": "Paid"}},
        {"$group": {"_id": "$user_id"}},
    ]
    active_ids = [r["_id"] for r in await orders_col.aggregate(pipeline).to_list(10000)]
    users_col = get_collection("users")
    total_users = await users_col.count_documents({})
    return max(0, total_users - len(active_ids))


async def top_customers(limit: int = 10) -> list[CustomerProfile]:
    """Top customers by total spend."""
    col = get_collection("orders")
    pipeline = [
        {"$match": {"payment_status": "Paid"}},
        {
            "$group": {
                "_id": "$user_id",
                "total_orders": {"$sum": 1},
                "total_spent": {"$sum": "$total_amount"},
                "last_order_at": {"$max": "$created_at"},
            }
        },
        {"$sort": {"total_spent": -1}},
        {"$limit": limit},
    ]
    result = await col.aggregate(pipeline).to_list(limit)

    users_col = get_collection("users")
    profiles: list[CustomerProfile] = []
    for r in result:
        user = await users_col.find_one({"_id": r["_id"]}) or {}
        profiles.append(
            CustomerProfile(
                user_id=str(r["_id"]),
                name=user.get("name", "Unknown"),
                email=user.get("email", ""),
                total_orders=r["total_orders"],
                total_spent=round(r["total_spent"], 2),
                last_order_at=r.get("last_order_at"),
            )
        )
    return profiles


async def get_customer_metrics() -> CustomerMetrics:
    return CustomerMetrics(
        repeat_customers=await repeat_customers(),
        first_time_customers=await first_time_customers(),
        abandoned_carts=await abandoned_carts(),
        inactive_customers=await inactive_customers(),
        top_customers=await top_customers(),
    )
