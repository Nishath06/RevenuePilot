"""
RevenuePilot AI — Live Today Activity Generator
Appends today's real-time orders, payments, events, and metrics to MongoDB.
"""
import asyncio
import sys
import os
import random
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


async def generate_today_activity() -> dict:
    """
    Appends fresh live orders, recovery events, and metrics for today.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    now = datetime.now(timezone.utc)
    today_prefix = now.strftime("%Y-%m-%d")

    # Fetch existing products & customers
    products = await db.products.find({}).to_list(length=100)
    customers = await db.customers.find({}).to_list(length=100)

    if not products or not customers:
        client.close()
        return {"status": "error", "message": "Products/Customers database empty. Please run seed script first."}

    new_orders = []
    new_payments = []
    new_events = []

    statuses = ["PAID", "FAILED", "CANCELLED"]
    weights = [0.75, 0.15, 0.10]
    payment_methods = ["UPI", "Card", "Wallet", "NetBanking"]

    # Generate 30 orders for today
    for i in range(30):
        o_id = f"ord_today_{uuid.uuid4().hex[:8]}"
        rzp_order_id = f"order_rzp_{uuid.uuid4().hex[:10]}"
        pay_id = f"pay_rzp_{uuid.uuid4().hex[:10]}"

        cust = random.choice(customers)
        prod = random.choice(products)
        status = random.choices(statuses, weights=weights)[0]
        method = random.choice(payment_methods)
        qty = random.choice([1, 2])

        subtotal = prod["price"] * qty
        tax = round(subtotal * 0.18, 2)
        total_amount = round(subtotal + tax, 2)

        p_id = prod.get("product_id", prod.get("id"))
        p_name = prod.get("title", prod.get("name", "Product"))
        beanie_status = "Paid" if status == "PAID" else ("Failed" if status == "FAILED" else "Cancelled")
        store_pay_status = "captured" if status == "PAID" else ("failed" if status == "FAILED" else "cancelled")

        ord_doc = {
            "order_id": o_id,
            "razorpay_order_id": rzp_order_id,
            "payment_id": pay_id,
            "customer_id": cust["customer_id"],
            "user_id": cust["customer_id"],
            "product_id": p_id,
            "product_name": p_name,
            "quantity": qty,
            "order_status": beanie_status,
            "payment_status": beanie_status,
            "status": status.lower(),
            "amount": total_amount,
            "total_amount": total_amount,
            "currency": "INR",
            "tax": tax,
            "discount": 0.0,
            "coupon_code": "",
            "created_at": now.isoformat(),
            "paid_at": now.isoformat() if status == "PAID" else None,
            "failure_reason": "BAD_GATEWAY_TIMEOUT" if status == "FAILED" else None,
            "payment_method": method,
            "city": cust["city"],
            "state": cust["state"],
            "items": [{
                "product_id": p_id,
                "title": p_name,
                "name": p_name,
                "quantity": qty,
                "price": prod["price"],
                "image": prod.get("images", [""])[0] if prod.get("images") else ""
            }],
        }
        new_orders.append(ord_doc)

        pay_doc = {
            "payment_id": pay_id,
            "razorpay_payment_id": pay_id if status == "PAID" else None,
            "order_id": o_id,
            "razorpay_order_id": rzp_order_id,
            "customer_id": cust["customer_id"],
            "customer_name": cust["name"],
            "customer_email": cust["email"],
            "customer_phone": cust["phone"],
            "product_name": p_name,
            "amount": total_amount,
            "payment_method": method,
            "method": method.lower(),
            "status": store_pay_status,
            "payment_status": status,
            "failure_reason": "BAD_GATEWAY_TIMEOUT" if status == "FAILED" else None,
            "webhook_latency_ms": random.randint(45, 180),
            "created_at": now.isoformat(),
        }
        new_payments.append(pay_doc)

        evt_doc = {
            "event_id": f"evt_today_{i}_{uuid.uuid4().hex[:6]}",
            "event_type": "PAYMENT_SUCCESS" if status == "PAID" else "PAYMENT_FAILED",
            "step": "Payment Processed",
            "source": "revenuepilot-store",
            "merchant_id": "merch_default",
            "trace_id": f"trace_today_{uuid.uuid4().hex[:8]}",
            "severity": "info" if status == "PAID" else "warning",
            "latency_ms": round(random.uniform(12.0, 65.0), 2),
            "execution_mode": "AWS EventBridge Mode",
            "service": "EventBridge",
            "status": "processed",
            "timestamp": now.isoformat(),
            "payload": {"order_id": o_id, "amount": total_amount, "customer": cust["name"]},
        }
        new_events.append(evt_doc)

    await db.orders.insert_many(new_orders)
    await db.payments.insert_many(new_payments)
    await db.events.insert_many(new_events)

    client.close()
    return {
        "status": "success",
        "orders_created": len(new_orders),
        "payments_created": len(new_payments),
        "events_created": len(new_events),
        "date": today_prefix,
        "message": f"Successfully generated {len(new_orders)} live activity orders for today!"
    }


if __name__ == "__main__":
    res = asyncio.run(generate_today_activity())
    print("\n========================================================")
    print(" REVENUEPILOT TODAY'S LIVE ACTIVITY GENERATION COMPLETE")
    print("========================================================")
    print(f" - Orders Created   : {res.get('orders_created', 0)}")
    print(f" - Payments Created : {res.get('payments_created', 0)}")
    print(f" - Events Emitted   : {res.get('events_created', 0)}")
    print("========================================================\n")
