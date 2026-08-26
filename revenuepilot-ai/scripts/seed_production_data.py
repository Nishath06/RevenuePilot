"""
RevenuePilot AI — Production Dummy Data Seeding Engine (v2.7)
Generates 90 days of realistic, rich ecommerce & cloud automation data for Indian merchant RevenuePilot Demo Store.
"""
import asyncio
import sys
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

# Ensure root workspace directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Sample Data Generators Setup
INDIAN_CITIES = [
    ("Mumbai", "Maharashtra"),
    ("Bengaluru", "Karnataka"),
    ("Delhi", "Delhi"),
    ("Hyderabad", "Telangana"),
    ("Pune", "Maharashtra"),
    ("Chennai", "Tamil Nadu"),
    ("Jaipur", "Rajasthan"),
    ("Ahmedabad", "Gujarat"),
    ("Kolkata", "West Bengal"),
    ("Surat", "Gujarat"),
    ("Indore", "Madhya Pradesh"),
    ("Chandigarh", "Punjab"),
]

FIRST_NAMES = [
    "Aarav", "Ananya", "Rohan", "Priya", "Vikram", "Neha", "Rahul", "Sneha", "Aditya", "Pooja",
    "Karan", "Divya", "Siddharth", "Meera", "Amit", "Kavya", "Varun", "Riya", "Arjun", "Tanvi",
    "Rajesh", "Sunita", "Deepak", "Shweta", "Sanjay", "Nisha", "Manoj", "Aarti", "Alok", "Simran"
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Gupta", "Singh", "Reddy", "Nair", "Joshi", "Kumar", "Mehta",
    "Shah", "Chawla", "Deshmukh", "Iyer", "Rao", "Bhasin", "Kapoor", "Malhotra", "Saxena", "Agarwal"
]

PRODUCT_TEMPLATES = [
    # Category: Wireless Audio
    ("AeroSound Pro Wireless Earbuds", "Wireless Audio", 2999, 140),
    ("BassPulse Bluetooth Headphones", "Wireless Audio", 4499, 85),
    ("SonicBoom Portable Speaker", "Wireless Audio", 1999, 210),
    ("AuraTune ANC Noise Cancelling Headphones", "Wireless Audio", 8999, 45),
    ("StudioClear Studio Monitors", "Wireless Audio", 14999, 20),
    # Category: Keyboards
    ("MechKeys RGB Mechanical Keyboard", "Keyboards", 3999, 65),
    ("SilentType Wireless Office Keyboard", "Keyboards", 1799, 120),
    ("ProGamer 60% Compact Keyboard", "Keyboards", 4999, 35),
    ("ErgoType Split Ergonomic Keyboard", "Keyboards", 6499, 15),
    # Category: Gaming
    ("ApexGlide Ultra Gaming Mouse", "Gaming", 2499, 90),
    ("HyperDrive PC Controller", "Gaming", 3199, 50),
    ("Vortex 7.1 Surround Gaming Headset", "Gaming", 5499, 40),
    ("TitanDesk RGB Gaming Mat", "Gaming", 1299, 180),
    # Category: Smart Watches
    ("FitPulse Smartwatch Gen 4", "Smart Watches", 3499, 110),
    ("AeroRun GPS Sports Watch", "Smart Watches", 7999, 30),
    ("LuxeTime Stainless Steel Hybrid Watch", "Smart Watches", 11999, 18),
    # Category: Mobile Accessories
    ("PowerVolt 20000mAh Power Bank", "Mobile Accessories", 1999, 300),
    ("MagCharge 15W Fast Wireless Pad", "Mobile Accessories", 1499, 150),
    ("FlexiMount Magnetic Car Phone Holder", "Mobile Accessories", 799, 250),
    ("ArmorShield Tempered Glass Pack", "Mobile Accessories", 499, 400),
    # Category: Cameras
    ("VlogCam 4K Digital Creator Camera", "Cameras", 28999, 12),
    ("StreamCam 1080p Full HD Webcam", "Cameras", 3999, 75),
    ("PocketGimbal 3-Axis Stabilizer", "Cameras", 9999, 22),
    # Category: Laptop Accessories
    ("LinkMax 8-in-1 USB-C Hub", "Laptop Accessories", 2799, 130),
    ("AirChill Aluminum Laptop Stand", "Laptop Accessories", 1899, 95),
    ("ProtecSleeve Waterproof Laptop Bag", "Laptop Accessories", 1299, 160),
    # Category: Home Office
    ("LuminaDesk Smart LED Lamp", "Home Office", 2299, 70),
    ("ErgoBack Memory Foam Lumbar Cushion", "Home Office", 1499, 110),
    ("ClearSound USB Desk Microphone", "Home Office", 3499, 55),
]


async def seed_production_data() -> dict:
    """
    Main seeding engine populating MongoDB with realistic merchant business data for 90 days.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    logger.info("Initializing RevenuePilot v2.7 Seeding Engine...")
    start_time = datetime.now(timezone.utc)
    now = datetime.now(timezone.utc)
    start_90d = now - timedelta(days=90)

    # 1. Clear Existing Demo Data
    collections_to_clear = [
        "orders", "payments", "customers", "users", "products", "inventory_events",
        "recovery_campaigns", "ai_conversations", "conversations", "reports",
        "generated_reports", "events", "lambda_executions", "cloudwatch_metrics",
        "execution_history", "incidents", "watchdog_snapshots", "watchdogs",
        "aws_audit_logs", "dlq_events", "recommendations", "customer_preferences"
    ]
    for c in collections_to_clear:
        await db[c].delete_many({})

    counts = {}

    # 2. SEED PRODUCTS (120 products)
    products_docs = []
    prod_ids = []
    category_counts = {
        "Wireless Audio": 0, "Keyboards": 0, "Gaming": 0, "Smart Watches": 0,
        "Mobile Accessories": 0, "Cameras": 0, "Laptop Accessories": 0, "Home Office": 0
    }

    BRANDS = ["AeroSound", "SonicBoom", "MechKeys", "FitPulse", "Titan", "VlogCam", "LinkMax", "Lumina", "Apex", "Vortex"]

    for i in range(120):
        base_item = PRODUCT_TEMPLATES[i % len(PRODUCT_TEMPLATES)]
        p_name = f"{base_item[0]} {chr(65 + (i // len(PRODUCT_TEMPLATES)))}" if i >= len(PRODUCT_TEMPLATES) else base_item[0]
        cat = base_item[1]
        base_price = base_item[2] + random.choice([-200, 0, 300, 500])
        category_counts[cat] += 1
        p_id = f"prod_{i+101:03d}"

        # Determine stock condition (normal, low stock, out of stock, dead stock)
        if i in [5, 18, 42]:
            stock = 0 # Out of stock
        elif i in [12, 29, 65, 88]:
            stock = random.randint(1, 4) # Low stock
        elif i in [15, 47, 92]:
            stock = random.randint(25, 60) # Dead stock candidate
        else:
            stock = random.randint(15, 180)

        views = random.randint(400, 8500)
        sales = 0 if i in [15, 47, 92] else random.randint(10, 320)
        rating = round(random.uniform(3.9, 4.9), 1)

        p_doc = {
            "product_id": p_id,
            "id": p_id,
            "sku": f"SKU-{cat[:3].upper()}-{i+101}",
            "title": p_name,        # Required by revenuepilot-store Beanie model
            "name": p_name,         # Required by revenuepilot-ai
            "description": f"High-performance {p_name} engineered for ultimate digital convenience and durability.",
            "brand": random.choice(BRANDS),
            "category": cat,
            "price": float(base_price),
            "stock": stock,
            "images": [f"https://images.unsplash.com/photo-1505740420928?auto=format&fit=crop&w=600&q=80"],
            "tags": [cat.lower(), "electronics", "lifestyle"],
            "low_stock_threshold": 5,
            "views": views,
            "sales": sales,
            "monthly_sales": sales // 3,
            "units_sold": sales,
            "rating": rating,
            "inventory_value": float(stock * base_price),
            "is_dead_stock": i in [15, 47, 92],
            "popularity_category": "DEAD_STOCK" if i in [15, 47, 92] else ("HOT" if sales > 150 else "TRENDING"),
            "created_at": (start_90d - timedelta(days=random.randint(10, 60))).isoformat(),
        }
        products_docs.append(p_doc)
        prod_ids.append(p_id)

    await db.products.insert_many(products_docs)
    counts["products"] = len(products_docs)

    # 3. SEED CUSTOMERS & USERS (600 customers)
    customers_docs = []
    users_docs = []
    cust_ids = []
    segments = ["VIP", "Repeat", "One-Time", "Dormant"]
    segment_weights = [0.15, 0.35, 0.40, 0.10]

    for i in range(600):
        c_id = f"cust_{i+1001:04d}"
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        city_info = random.choice(INDIAN_CITIES)
        seg = random.choices(segments, weights=segment_weights)[0]

        total_orders = random.randint(8, 24) if seg == "VIP" else (random.randint(3, 7) if seg == "Repeat" else (random.randint(1, 2) if seg == "One-Time" else 1))
        ltv = float(sum(random.randint(1500, 9500) for _ in range(total_orders)))

        created_dt = start_90d + timedelta(days=random.randint(0, 85))

        email_str = f"{fn.lower()}.{ln.lower()}{i+10}@example.com"
        c_doc = {
            "customer_id": c_id,
            "name": f"{fn} {ln}",
            "email": email_str,
            "phone": f"+9198{random.randint(10000000, 99999999)}",
            "city": city_info[0],
            "state": city_info[1],
            "segment": seg,
            "lifetime_value": ltv,
            "total_orders": total_orders,
            "preferred_payment": random.choice(["UPI", "Card", "Wallet", "NetBanking"]),
            "preferred_channel": random.choice(["WhatsApp", "Email", "SMS"]),
            "created_at": created_dt.isoformat(),
        }
        customers_docs.append(c_doc)
        cust_ids.append(c_id)

        # store user doc
        user_doc = {
            "name": f"{fn} {ln}",
            "email": email_str,
            "phone": c_doc["phone"],
            "password_hash": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW",
            "created_at": created_dt.isoformat(),
        }
        users_docs.append(user_doc)

    await db.customers.insert_many(customers_docs)
    await db.users.insert_many(users_docs)
    counts["customers"] = len(customers_docs)
    counts["users"] = len(users_docs)

    # 4. SEED ORDERS & PAYMENTS (2,500 orders)
    orders_docs = []
    payments_docs = []
    inventory_events_docs = []

    statuses = ["PAID", "FAILED", "CANCELLED", "PENDING", "REFUNDED"]
    status_weights = [0.72, 0.12, 0.08, 0.05, 0.03]
    payment_methods = ["UPI", "Card", "Wallet", "NetBanking", "EMI"]
    method_weights = [0.55, 0.25, 0.10, 0.06, 0.04]
    failure_reasons = [
        "BAD_GATEWAY_TIMEOUT", "INSUFFICIENT_FUNDS", "NETWORK_FAILURE",
        "BANK_SERVER_DOWN", "AUTHENTICATION_FAILED", "UPI_PIN_EXPIRED"
    ]

    for i in range(2500):
        # Create timestamps over 90 days with day-of-week & holiday peaks
        day_offset = random.randint(0, 89)
        order_date = start_90d + timedelta(days=day_offset)

        # Higher sales on Fri (4), Sat (5), Sun (6)
        if order_date.weekday() in [4, 5, 6] and random.random() < 0.2:
            pass  # Normal flow

        # Time of day (lower at night 00-06)
        hour = random.choices(list(range(24)), weights=[1,1,1,1,1,2,3,5,7,9,10,9,8,8,9,10,11,12,12,11,9,7,5,3])[0]
        order_dt = order_date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
        order_iso = order_dt.isoformat()

        o_id = f"ord_90d_{i+10001:05d}"
        rzp_order_id = f"order_rzp_{uuid.uuid4().hex[:10]}"
        pay_id = f"pay_rzp_{uuid.uuid4().hex[:10]}"

        cust = random.choice(customers_docs)
        prod = random.choice(products_docs)
        qty = random.choices([1, 2, 3], weights=[0.85, 0.12, 0.03])[0]

        status = random.choices(statuses, weights=status_weights)[0]
        method = random.choices(payment_methods, weights=method_weights)[0]

        unit_price = prod["price"]
        subtotal = unit_price * qty
        tax = round(subtotal * 0.18, 2)

        coupon = ""
        discount = 0.0
        if random.random() < 0.25:
            coupon = random.choice(["WELCOME10", "FESTIVE15", "RECOVER10", "COMEBACK5"])
            discount = round(subtotal * (0.10 if "10" in coupon else 0.05), 2)

        total_amount = round(subtotal + tax - discount, 2)

        paid_at = (order_dt + timedelta(seconds=random.randint(15, 120))).isoformat() if status in ["PAID", "REFUNDED"] else None
        cancelled_at = (order_dt + timedelta(minutes=random.randint(5, 60))).isoformat() if status == "CANCELLED" else None
        fail_reason = random.choice(failure_reasons) if status in ["FAILED", "CANCELLED"] else None

        # Format status for Beanie Order model: Pending, Paid, Failed, Cancelled
        beanie_status = "Paid" if status == "PAID" else ("Failed" if status == "FAILED" else ("Cancelled" if status == "CANCELLED" else "Pending"))

        ord_doc = {
            "order_id": o_id,
            "razorpay_order_id": rzp_order_id,
            "payment_id": pay_id,
            "customer_id": cust["customer_id"],
            "user_id": cust["customer_id"],
            "product_id": prod["product_id"],
            "product_name": prod["name"],
            "quantity": qty,
            "order_status": beanie_status,
            "payment_status": beanie_status,
            "status": status.lower(),
            "amount": total_amount,
            "total_amount": total_amount,  # Required by revenuepilot-store Beanie Order model
            "currency": "INR",
            "tax": tax,
            "discount": discount,
            "coupon_code": coupon,
            "created_at": order_iso,
            "paid_at": paid_at,
            "cancelled_at": cancelled_at,
            "failure_reason": fail_reason,
            "payment_method": method,
            "city": cust["city"],
            "state": cust["state"],
            "items": [{
                "product_id": prod["product_id"],
                "title": prod["name"],      # Required by OrderItem in revenuepilot-store
                "name": prod["name"],
                "quantity": qty,
                "price": unit_price,
                "image": prod["images"][0]
            }],
            "payment_events": [
                {
                    "status": beanie_status,
                    "timestamp": order_iso,
                    "reason": fail_reason
                }
            ]
        }
        orders_docs.append(ord_doc)

        # Payment record with webhook structure
        store_pay_status = "captured" if status == "PAID" else ("failed" if status == "FAILED" else ("cancelled" if status == "CANCELLED" else "pending"))
        pay_doc = {
            "payment_id": pay_id,
            "razorpay_payment_id": pay_id if status in ["PAID", "REFUNDED"] else None,
            "order_id": o_id,
            "razorpay_order_id": rzp_order_id,
            "customer_id": cust["customer_id"],
            "customer_name": cust["name"],
            "customer_email": cust["email"],
            "customer_phone": cust["phone"],
            "product_name": prod["name"],
            "amount": total_amount,
            "payment_method": method,
            "method": method.lower(),
            "status": store_pay_status,  # captured, failed, cancelled, pending
            "payment_status": status,
            "failure_reason": fail_reason,
            "error_code": fail_reason,
            "webhook_latency_ms": random.randint(45, 240),
            "webhook_events": [
                {"event": "payment.authorized", "timestamp": order_iso},
                {"event": f"payment.{'captured' if status == 'PAID' else 'failed'}", "timestamp": paid_at or order_iso}
            ],
            "created_at": order_iso,
        }
        payments_docs.append(pay_doc)

        # Inventory event for deduction or restock
        inv_event = {
            "event_id": f"invevent_{i+10001:05d}",
            "product_id": prod["product_id"],
            "product_name": prod["name"],
            "change_type": "SALE_DEDUCTION" if status == "PAID" else "RESERVE_RELEASE",
            "quantity_change": -qty if status == "PAID" else 0,
            "remaining_stock": prod["stock"],
            "timestamp": order_iso,
        }
        inventory_events_docs.append(inv_event)

    await db.orders.insert_many(orders_docs)
    await db.payments.insert_many(payments_docs)
    await db.inventory_events.insert_many(inventory_events_docs[:500])
    counts["orders"] = len(orders_docs)
    counts["payments"] = len(payments_docs)
    counts["inventory_events"] = len(inventory_events_docs[:500])

    # 5. SEED RECOVERY CAMPAIGNS (180 campaigns)
    campaigns_docs = []
    camp_types = ["Failed Payment", "Cancelled Order", "Abandoned Cart", "Dead Stock Discount", "Inventory Clearance"]

    for i in range(180):
        c_type = random.choice(camp_types)
        c_dt = start_90d + timedelta(days=random.randint(1, 88))

        is_converted = random.random() < 0.18 # 18% conversion rate rule
        is_clicked = is_converted or (random.random() < 0.35)
        is_opened = is_clicked or (random.random() < 0.65)

        coupon = f"RECOVER_{uuid.uuid4().hex[:5].upper()}"
        cust = random.choice(customers_docs)

        camp_doc = {
            "campaign_id": f"camp_{i+101:03d}",
            "campaign_type": c_type,
            "customer_id": cust["customer_id"],
            "customer_name": cust["name"],
            "customer_email": cust["email"],
            "customer_phone": cust["phone"],
            "amount": float(random.randint(1499, 8999)),
            "coupon": coupon,
            "coupon_code": coupon,
            "discount": random.choice(["5%", "10%", "15%", "Free Shipping"]),
            "channel": random.choice(["WhatsApp", "Email", "WhatsApp + Email", "Push Notification"]),
            "status": "completed" if is_converted else ("active" if (now - c_dt).days < 2 else "expired"),
            "opened": is_opened,
            "clicked": is_clicked,
            "converted": is_converted,
            "created_at": c_dt.isoformat(),
        }
        campaigns_docs.append(camp_doc)

    await db.recovery_campaigns.insert_many(campaigns_docs)
    counts["recovery_campaigns"] = len(campaigns_docs)

    # 6. SEED AI CONVERSATIONS (35 conversations, 8-20 messages each)
    ai_conv_docs = []
    topics = [
        "Revenue Analysis", "Inventory Suggestions", "Customer Retention",
        "Failed Payments", "Forecasting", "Recovery Strategy", "Webhook Health", "AWS Diagnostics"
    ]

    for i in range(35):
        conv_id = f"conv_{i+101:03d}"
        topic = topics[i % len(topics)]
        c_dt = start_90d + timedelta(days=random.randint(2, 85))

        msg_count = random.randint(8, 16)
        messages = []
        for m in range(msg_count):
            role = "user" if m % 2 == 0 else "assistant"
            text = f"User query regarding {topic} for segment performance." if role == "user" else f"RevenuePilot AI Assistant response with real-time MongoDB aggregations & CloudWatch metrics for {topic}."
            messages.append({
                "message_id": f"msg_{i}_{m}",
                "role": role,
                "content": text,
                "timestamp": (c_dt + timedelta(minutes=m*3)).isoformat(),
            })

        conv_doc = {
            "conversation_id": conv_id,
            "title": f"AI Session: {topic} ({c_dt.strftime('%b %d')})",
            "topic": topic,
            "merchant_id": "merch_default",
            "messages": messages,
            "created_at": c_dt.isoformat(),
            "updated_at": (c_dt + timedelta(minutes=msg_count*3)).isoformat(),
        }
        ai_conv_docs.append(conv_doc)

    await db.ai_conversations.insert_many(ai_conv_docs)
    await db.conversations.insert_many(ai_conv_docs) # Duplicate for both collection aliases
    counts["ai_conversations"] = len(ai_conv_docs)

    # 7. SEED REPORTS (40 reports)
    reports_docs = []
    rep_types = ["revenue", "payment", "inventory", "customer", "recovery", "security"]

    for i in range(40):
        r_type = rep_types[i % len(rep_types)]
        fmt = random.choice(["csv", "json", "pdf"])
        r_dt = start_90d + timedelta(days=random.randint(1, 89))
        fname = f"revenuepilot_{r_type}_{r_dt.strftime('%Y%m%d')}_{uuid.uuid4().hex[:4]}.{fmt}"
        s3_url = f"s3://revenuepilot-reports/reports/{fname}"

        rep_doc = {
            "report_id": f"rep_{i+101:03d}",
            "report_type": r_type,
            "format": fmt,
            "filename": fname,
            "size": random.randint(1240, 48200),
            "record_count": random.randint(50, 850),
            "date_range": random.choice(["today", "7d", "30d"]),
            "status": random.choice(["S3 STORED", "LOCAL STORAGE"]),
            "s3_url": s3_url,
            "download_url": f"/automation/reports/download/{fname}",
            "created_at": r_dt.isoformat(),
            "generated_at": r_dt.isoformat(),
            "content": f"RevenuePilot Operational Report ({r_type.upper()}) generated for {r_dt.isoformat()}",
        }
        reports_docs.append(rep_doc)

    await db.reports.insert_many(reports_docs)
    await db.generated_reports.insert_many(reports_docs)
    counts["reports"] = len(reports_docs)

    # 8. SEED EVENT TIMELINE (500 AutoOps events)
    events_docs = []
    event_types = [
        "PAYMENT_FAILED", "LOW_STOCK", "OUT_OF_STOCK", "REVENUE_DROP",
        "ABANDONED_CART", "RECOVERY_SUCCESS", "INCIDENT_CREATED",
        "REPORT_GENERATED", "AWS_LAMBDA_INVOKED", "SNS_NOTIFICATION", "S3_UPLOAD"
    ]

    for i in range(500):
        e_type = random.choice(event_types)
        e_dt = start_90d + timedelta(days=random.randint(0, 89), minutes=random.randint(0, 1439))
        trace = f"trace_{uuid.uuid4().hex[:12]}"

        evt_doc = {
            "event_id": f"evt_{i+10001:05d}",
            "event_type": e_type,
            "step": e_type.replace("_", " ").title(),
            "source": random.choice(["revenuepilot-store", "recovery-engine", "inventory-watchdog", "autoops-scheduler"]),
            "merchant_id": "merch_default",
            "trace_id": trace,
            "severity": "critical" if "FAIL" in e_type or "OUT" in e_type else ("warning" if "LOW" in e_type or "DROP" in e_type else "info"),
            "latency_ms": round(random.uniform(8.5, 140.0), 2),
            "execution_mode": random.choice(["AWS EventBridge Mode", "Local Event Bus Mode"]),
            "service": random.choice(["EventBridge", "Lambda", "SNS", "S3", "CloudWatch"]),
            "status": "processed",
            "timestamp": e_dt.isoformat(),
            "payload": {
                "trace_id": trace,
                "event_type": e_type,
                "amount": random.randint(1999, 14999),
                "customer": "RevenuePilot Customer",
            }
        }
        events_docs.append(evt_doc)

    await db.events.insert_many(events_docs)
    counts["events"] = len(events_docs)

    # 9. SEED LAMBDA EXECUTIONS (220 executions)
    lambda_docs = []
    lambda_funcs = ["InventoryLambda", "RecoveryLambda", "ReportsLambda", "IncidentLambda", "CloudWatchLambda"]

    for i in range(220):
        fn_name = random.choice(lambda_funcs)
        l_dt = start_90d + timedelta(days=random.randint(0, 89), minutes=random.randint(0, 1439))

        lam_doc = {
            "execution_id": f"lam_{i+1001:04d}",
            "request_id": f"req_aws_{uuid.uuid4().hex[:12]}",
            "function_name": fn_name,
            "merchant_id": "merch_default",
            "duration_ms": round(random.uniform(45.0, 320.0), 2),
            "memory_used": random.choice([128, 256, 512]),
            "cold_start": random.random() < 0.08,
            "status": "SUCCESS" if random.random() > 0.04 else "FAILED",
            "execution_mode": "AWS Boto3 Lambda",
            "timestamp": l_dt.isoformat(),
            "payload": {"function": fn_name, "status": "executed"}
        }
        lambda_docs.append(lam_doc)

    await db.lambda_executions.insert_many(lambda_docs)
    counts["lambda_executions"] = len(lambda_docs)

    # 10. SEED CLOUDWATCH METRICS (Hourly for 90 days = ~2160 metrics)
    metrics_docs = []
    for h in range(90 * 24):
        m_dt = start_90d + timedelta(hours=h)
        metrics_doc = {
            "timestamp": m_dt.isoformat(),
            "OrdersProcessed": random.randint(1, 8),
            "RevenueGenerated": float(random.randint(2500, 35000)),
            "FailedPayments": random.randint(0, 2),
            "RecoveredPayments": random.randint(0, 2),
            "InventoryAlerts": random.randint(0, 3),
            "WebhookLatency": round(random.uniform(50.0, 180.0), 2),
            "SchedulerExecutions": random.randint(1, 4),
            "LambdaInvocations": random.randint(2, 10),
            "PaymentSuccessRate": round(random.uniform(78.0, 96.0), 1),
            "DatabaseLatency": round(random.uniform(2.5, 14.0), 2),
            "APIRequests": random.randint(15, 120),
        }
        metrics_docs.append(metrics_doc)

    await db.cloudwatch_metrics.insert_many(metrics_docs)
    counts["cloudwatch_metrics"] = len(metrics_docs)

    # 11. SEED SCHEDULER HISTORY (execution_history)
    sched_history = []
    schedulers = [
        "Inventory Watchdog Daily Scan", "Revenue Watchdog Monitor",
        "Failed Payment Recovery Campaign", "Cancelled Order Comeback Offer",
        "Daily Operational Report Exporter"
    ]

    for i in range(150):
        s_name = random.choice(schedulers)
        s_dt = start_90d + timedelta(days=random.randint(0, 89), minutes=random.randint(0, 1439))
        sched_doc = {
            "execution_id": f"exec_sch_{i+1001:04d}",
            "rule_name": s_name,
            "trigger": "SCHEDULED_CRON",
            "status": "success",
            "started_at": s_dt.isoformat(),
            "completed_at": (s_dt + timedelta(seconds=random.randint(1, 8))).isoformat(),
            "duration_ms": round(random.uniform(450.0, 2800.0), 2),
            "items_scanned": random.randint(40, 120),
            "actions_triggered": random.randint(1, 6),
            "timestamp": s_dt.isoformat(),
        }
        sched_history.append(sched_doc)

    await db.execution_history.insert_many(sched_history)
    counts["execution_history"] = len(sched_history)

    # 12. SEED INCIDENTS (60 incidents)
    incidents_docs = []
    severities = ["critical", "high", "medium", "low"]
    statuses_inc = ["resolved", "investigating", "open"]

    for i in range(60):
        inc_dt = start_90d + timedelta(days=random.randint(1, 89))
        sev = random.choices(severities, weights=[0.15, 0.30, 0.35, 0.20])[0]
        st = random.choices(statuses_inc, weights=[0.75, 0.15, 0.10])[0]

        inc_doc = {
            "id": f"inc_{i+101:03d}",
            "title": f"Incident: {sev.upper()} - Payment Gateway Latency Spike" if i % 2 == 0 else f"Incident: Stock Depletion Alert ({prod_ids[i % len(prod_ids)]})",
            "severity": sev,
            "status": st,
            "source": random.choice(["CloudWatch Alarm", "Inventory Watchdog", "Webhook Monitor"]),
            "description": f"Automated alert detected threshold breach at {inc_dt.strftime('%H:%M:%S')}",
            "created_at": inc_dt.isoformat(),
            "resolved_at": (inc_dt + timedelta(hours=random.randint(1, 12))).isoformat() if st == "resolved" else None,
        }
        incidents_docs.append(inc_doc)

    await db.incidents.insert_many(incidents_docs)
    counts["incidents"] = len(incidents_docs)

    # 13. SEED WATCHDOG SNAPSHOTS (watchdog_snapshots & watchdogs)
    watchdogs_list = ["Revenue", "Inventory", "Payments", "Recovery", "Webhook", "Customer", "Incident"]
    watchdog_docs = []

    for w in watchdogs_list:
        wd_doc = {
            "id": f"wd_{w.lower()}",
            "name": f"{w} Watchdog",
            "status": "Healthy" if w != "Payments" else "Warning",
            "health": "96/100",
            "last_scan": now.isoformat(),
            "next_scan": (now + timedelta(minutes=15)).isoformat(),
            "latency_ms": random.randint(12, 45),
            "duration_ms": random.randint(120, 480),
            "issues_found": 0 if w != "Payments" else 2,
            "items_scanned": random.randint(120, 600),
            "retry_count": 0,
            "description": f"Autonomous scan monitoring {w.lower()} anomalies and operational health.",
        }
        watchdog_docs.append(wd_doc)

    await db.watchdog_snapshots.insert_many(watchdog_docs)
    await db.watchdogs.insert_many(watchdog_docs)
    counts["watchdogs"] = len(watchdog_docs)

    # 14. SEED AUDIT LOGS (700 audit records)
    audit_docs = []
    for i in range(700):
        a_dt = start_90d + timedelta(days=random.randint(0, 89), minutes=random.randint(0, 1439))
        audit_doc = {
            "audit_id": f"aud_{i+10001:05d}",
            "actor": random.choice(["System AutoOps", "AWS EventBridge", "Lambda Service", "Admin Merchant"]),
            "action": random.choice(["INVOKE_LAMBDA", "PUBLISH_EVENT", "GENERATE_REPORT", "RECOVER_PAYMENT", "UPDATE_STOCK"]),
            "resource": random.choice(["revenuepilot-event-bus", "revenuepilot-reports", "InventoryLambda", "RecoveryLambda"]),
            "aws_service": random.choice(["EventBridge", "Lambda", "SNS", "S3", "CloudWatch"]),
            "request_id": f"req_aud_{uuid.uuid4().hex[:10]}",
            "trace_id": f"trace_aud_{uuid.uuid4().hex[:10]}",
            "latency_ms": round(random.uniform(5.0, 85.0), 2),
            "status": "SUCCESS",
            "created_at": a_dt.isoformat(),
            "timestamp": a_dt.isoformat(),
        }
        audit_docs.append(audit_doc)

    await db.aws_audit_logs.insert_many(audit_docs)
    counts["aws_audit_logs"] = len(audit_docs)

    # 15. SEED RECOMMENDATIONS
    recs_docs = [
        {
            "id": "rec_001",
            "type": "DEAD_STOCK_CLEARANCE",
            "title": "Clearance Discount: LuxeTime Watch",
            "description": "Zero sales recorded in 30 days with 18 units in stock. Suggest 25% discount.",
            "priority": "high",
            "created_at": now.isoformat()
        },
        {
            "id": "rec_002",
            "type": "RESTOCK",
            "title": "Restock ProGamer Keyboard",
            "description": "Inventory stock level (4 units) is below safety threshold (5).",
            "priority": "high",
            "created_at": now.isoformat()
        }
    ]
    await db.recommendations.insert_many(recs_docs)

    client.close()
    elapsed = round((datetime.now(timezone.utc) - start_time).total_seconds(), 2)

    logger.info("RevenuePilot v2.7 Seeding Complete", duration_sec=elapsed, counts=counts)
    return {
        "status": "success",
        "duration_seconds": elapsed,
        "collections": counts,
        "message": "90-Day Demo Merchant Store data successfully seeded!"
    }


if __name__ == "__main__":
    res = asyncio.run(seed_production_data())
    print("\n========================================================")
    print(" REVENUEPILOT v2.7 — PRODUCTION DATA SEEDING COMPLETE")
    print("========================================================")
    for col, count in res["collections"].items():
        print(f" - {col:<25}: {count} documents inserted")
    print(f"\nTotal Seeding Duration: {res['duration_seconds']} seconds")
    print("========================================================\n")
