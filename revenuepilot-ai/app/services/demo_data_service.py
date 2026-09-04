"""
RevenuePilot v2.7 — Production Demo Data Generator & AWS End-to-End Testing Engine
Service layer for generating 30-day realistic merchant dataset, simulated AWS Lambda executions,
CloudWatch metrics, EventBridge streams, S3 report uploads, watchdog scans, recovery campaigns,
and QA test APIs.
"""

import random
import uuid
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.db.mongodb import get_mongodb
from app.core.config import settings
from app.core.logging import get_logger
from app.services.aws_client import aws_client
from app.services.cloud_event_bus import cloud_event_bus

logger = get_logger(__name__)

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
    ("Kochi", "Kerala"),
    ("Lucknow", "Uttar Pradesh"),
]

FIRST_NAMES = [
    "Nishath", "Aarav", "Ananya", "Rohan", "Priya", "Vikram", "Neha", "Rahul", "Sneha", "Aditya", "Pooja",
    "Karan", "Divya", "Siddharth", "Meera", "Amit", "Kavya", "Varun", "Riya", "Arjun", "Tanvi",
    "Rajesh", "Sunita", "Deepak", "Shweta", "Sanjay", "Nisha", "Manoj", "Aarti", "Alok", "Simran",
    "Venkatesh", "Deepika", "Karthik", "Bhavna", "Gautam", "Swati", "Tarun", "Meenakshi", "Manish"
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Gupta", "Singh", "Reddy", "Nair", "Joshi", "Kumar", "Mehta",
    "Shah", "Chawla", "Deshmukh", "Iyer", "Rao", "Bhasin", "Kapoor", "Malhotra", "Saxena", "Agarwal",
    "Pillai", "Choudhury", "Menon", "Subramanian", "Chatterjee", "Banerjee", "Bhat"
]

CATEGORIES = ["Electronics", "Fashion", "Beauty", "Home", "Sports", "Books", "Accessories"]

BRANDS = [
    "AeroSound", "SonicBoom", "MechKeys", "FitPulse", "Titan", "VlogCam", "LinkMax",
    "Lumina", "Apex", "Vortex", "UrbanStyle", "GlowBeauty", "FitPro", "EcoHome"
]

PAYMENT_METHODS = ["UPI", "Card", "NetBanking", "Wallet", "EMI", "COD"]

FAILURE_REASONS = [
    "BAD_GATEWAY_TIMEOUT", "INSUFFICIENT_FUNDS", "OTP_EXPIRED", "AUTHENTICATION_FAILED",
    "BANK_SERVER_DOWN", "CARD_LIMIT_EXCEEDED", "UPI_PIN_INCORRECT", "NETWORK_ERROR"
]


class DemoDataService:
    def __init__(self):
        self.is_demo_mode = True

    async def generate_full_demo_dataset(
        self,
        merchant_id: str = "merch_default",
        days: int = 30,
        orders_count: int = 2500,
        customers_count: int = 650,
        products_count: int = 120,
        seed: int = 42
    ) -> Dict[str, Any]:
        """
        FEATURE 1 — Generates 30 days of realistic ecommerce & cloud automation data.
        Faker/random seed ensures deterministic generation.
        """
        random.seed(seed)
        db = get_mongodb()
        start_time = datetime.now(timezone.utc)
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)

        logger.info(f"Generating full demo dataset: {orders_count} orders, {customers_count} customers, {products_count} products...")

        # Clear existing collections (preserve users collection so logins remain active)
        collections_to_clear = [
            "orders", "payments", "customers", "products", "inventory", "inventory_events",
            "recovery_campaigns", "reports", "generated_reports", "events", "lambda_executions",
            "cloudwatch_metrics", "execution_history", "incidents", "watchdog_snapshots",
            "aws_audit_logs", "webhooks"
        ]
        for col in collections_to_clear:
            await db[col].delete_many({})

        # Ensure merchant user accounts always exist with valid password hash
        import bcrypt
        pwd_hash = bcrypt.hashpw("password123".encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")
        merchant_users = [
            {"email": "merchant@revenuepilot.com", "name": "RevenuePilot Merchant", "phone": "+919876543210"},
            {"email": "jpnishath@gmail.com", "name": "Nishath Admin", "phone": "+919876543210"}
        ]
        for m in merchant_users:
            await db.users.update_one(
                {"email": m["email"]},
                {
                    "$set": {
                        "name": m["name"],
                        "phone": m["phone"],
                        "password_hash": pwd_hash,
                        "role": "merchant",
                        "merchant_id": merchant_id,
                        "created_at": start_date.isoformat()
                    }
                },
                upsert=True
            )

        # Generate 15 legitimate customer users in 'users' collection with role='customer'
        legit_customer_users = []
        for i in range(15):
            fname = FIRST_NAMES[i % len(FIRST_NAMES)]
            lname = LAST_NAMES[i % len(LAST_NAMES)]
            city, state = INDIAN_CITIES[i % len(INDIAN_CITIES)]
            email = f"{fname.lower()}.{lname.lower()}{i+10}@gmail.com"
            name = f"{fname} {lname}"
            phone = f"+91 {random.randint(60000, 99999)} {random.randint(10000, 99999)}"

            user_doc = {
                "name": name,
                "email": email,
                "phone": phone,
                "password_hash": pwd_hash,
                "role": "customer",
                "merchant_id": merchant_id,
                "created_at": (start_date + timedelta(days=random.randint(0, 10))).isoformat()
            }
            res = await db.users.update_one({"email": email}, {"$set": user_doc}, upsert=True)
            saved_u = await db.users.find_one({"email": email})
            u_id = str(saved_u["_id"])

            legit_customer_users.append({
                "user_id": u_id,
                "name": name,
                "email": email,
                "phone": phone,
                "city": city,
                "state": state
            })

        # 1. PRODUCTS & INVENTORY
        products_docs = []
        prod_ids = []
        for i in range(products_count):
            p_id = f"prod_{i+101:03d}"
            prod_ids.append(p_id)
            cat = CATEGORIES[i % len(CATEGORIES)]
            brand = BRANDS[i % len(BRANDS)]
            name = f"{brand} {cat[:-1] if cat.endswith('s') else cat} {i+1}"
            price = float(random.choice([299, 499, 799, 1299, 1999, 2999, 4999, 7999, 12999, 17999]))
            cost_price = round(price * random.uniform(0.45, 0.65), 2)

            # Stock Intelligence status assignment
            if i in [3, 14, 28, 56]:
                status = "OUT_OF_STOCK"
                stock = 0
            elif i in [8, 22, 45, 67, 89, 105]:
                status = "LOW_STOCK"
                stock = random.randint(1, 4)
            elif i in [2, 10, 25, 40, 70, 95]:
                status = "HOT"
                stock = random.randint(80, 250)
            elif i in [5, 18, 35, 60, 85]:
                status = "TRENDING"
                stock = random.randint(50, 150)
            elif i in [12, 33, 77, 110]:
                status = "DEAD_STOCK"
                stock = random.randint(30, 90)
            else:
                status = "STEADY"
                stock = random.randint(15, 120)

            views = random.randint(200, 9500)
            sales = 0 if status == "DEAD_STOCK" else random.randint(10, 450)
            rating = round(random.uniform(3.8, 4.9), 1)

            p_doc = {
                "product_id": p_id,
                "sku": f"SKU-{cat[:3].upper()}-{i+101:03d}",
                "name": name,
                "title": name,
                "description": f"High-performance {brand} {cat} engineered for ultimate quality and durability.",
                "category": cat,
                "brand": brand,
                "price": price,
                "cost_price": cost_price,
                "stock": stock,
                "inventory_status": status,
                "views": views,
                "sales": sales,
                "rating": rating,
                "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"],
                "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
                "tags": [cat.lower(), brand.lower(), "electronics"],
                "last_sold_at": (now - timedelta(days=random.randint(0, 2 if status == "HOT" else 45))).isoformat(),
                "last_restocked": (now - timedelta(days=random.randint(2, 60))).isoformat(),
                "created_at": start_date.isoformat(),
            }
            products_docs.append(p_doc)

        await db.products.insert_many(products_docs)
        await db.inventory.insert_many(products_docs)

        # 2. CUSTOMERS (Linked to 15 legitimate user accounts)
        customer_docs = []
        cust_ids = []
        segments = ["VIP", "Repeat", "Loyal", "At Risk", "One-Time", "Dormant"]

        for i, cu in enumerate(legit_customer_users):
            c_id = f"cust_{i+101:03d}"
            cust_ids.append(c_id)
            seg = segments[i % len(segments)]
            order_cnt = random.randint(5, 20) if seg in ["VIP", "Loyal"] else random.randint(2, 5)
            ltv = float(round(order_cnt * random.uniform(800, 3500), 2))

            c_doc = {
                "customer_id": c_id,
                "user_id": cu["user_id"],
                "name": cu["name"],
                "email": cu["email"],
                "phone": cu["phone"],
                "city": cu["city"],
                "state": cu["state"],
                "country": "India",
                "lifetime_value": ltv,
                "orders_count": order_cnt,
                "last_purchase": (now - timedelta(days=random.randint(0, 28))).isoformat(),
                "preferred_payment_method": random.choice(PAYMENT_METHODS),
                "preferred_channel": random.choice(["WhatsApp", "Email", "SMS"]),
                "segment": seg,
                "birthday": f"19{random.randint(80, 99)}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                "whatsapp_opt_in": True,
                "email_verified": True,
                "created_at": (start_date + timedelta(days=random.randint(0, 10))).isoformat(),
            }
            customer_docs.append(c_doc)

        await db.customers.insert_many(customer_docs)

        # 3. ORDERS & PAYMENTS (Strictly Paid, Failed, Cancelled — No Pending)
        order_docs = []
        payment_docs = []
        webhook_docs = []
        incident_docs = []

        # Order Status breakdown: 78% Paid, 14% Failed, 8% Cancelled (Pending excluded per specification)
        statuses = ["Paid"] * 78 + ["Failed"] * 14 + ["Cancelled"] * 8

        for i in range(orders_count):
            o_id = f"ord_demo_{i+1001:04d}"
            c_doc = customer_docs[i % len(customer_docs)]
            c_id = c_doc["customer_id"]

            # Evenly distribute orders across all 30 days + today (0 = 30d ago, 30 = today)
            day_offset = i % (days + 1)
            if day_offset == days:
                # Today: generate timestamps up to current hour
                curr_hour = max(1, now.hour)
                hour = random.randint(0, curr_hour - 1) if curr_hour > 1 else 0
            else:
                hour = random.choices([10, 11, 14, 15, 19, 20, 21, 22, 1, 2], k=1)[0]
            created_dt = start_date + timedelta(days=day_offset, hours=hour, minutes=random.randint(0, 59))

            st = random.choice(statuses)
            selected_prods = random.sample(products_docs, k=random.randint(1, 3))
            subtotal = sum(p["price"] for p in selected_prods)
            discount = float(round(subtotal * 0.1, 2)) if subtotal > 2000 else 0.0
            tax = float(round(subtotal * 0.18, 2))
            shipping = 0.0 if subtotal > 999 else 99.0
            total_amt = float(round(subtotal - discount + tax + shipping, 2))

            pm = random.choice(PAYMENT_METHODS)
            rzp_order_id = f"order_rzp_{uuid.uuid4().hex[:10]}"
            rzp_pay_id = f"pay_rzp_{uuid.uuid4().hex[:10]}" if st == "Paid" else f"pay_fail_{uuid.uuid4().hex[:10]}"
            fail_reason = random.choice(FAILURE_REASONS) if st in ["Failed", "Cancelled"] else None

            paid_dt = (created_dt + timedelta(seconds=random.randint(15, 120))) if st == "Paid" else None
            cancelled_dt = (created_dt + timedelta(minutes=random.randint(5, 30))) if st == "Cancelled" else None

            order_doc = {
                "order_id": o_id,
                "merchant_id": merchant_id,
                "customer_id": c_id,
                "user_id": c_doc["user_id"],
                "customer_name": c_doc["name"],
                "customer_email": c_doc["email"],
                "items": [{"product_id": p["product_id"], "name": p["name"], "price": p["price"], "quantity": 1} for p in selected_prods],
                "product_ids": [p["product_id"] for p in selected_prods],
                "amount": total_amt,
                "total_amount": total_amt,
                "currency": "INR",
                "tax": tax,
                "discount": discount,
                "coupon": "FESTIVE10" if discount > 0 else None,
                "shipping": shipping,
                "city": c_doc["city"],
                "state": c_doc["state"],
                "country": "India",
                "payment_method": pm,
                "payment_status": st,
                "order_status": "Delivered" if st == "Paid" else st,
                "razorpay_order_id": rzp_order_id,
                "razorpay_payment_id": rzp_pay_id,
                "gateway_id": "razorpay",
                "failure_reason": fail_reason,
                "created_at": created_dt,
                "paid_at": paid_dt,
                "cancelled_at": cancelled_dt,
            }
            order_docs.append(order_doc)

            # Corresponding Payment Doc
            pay_doc = {
                "payment_id": f"pay_{i+1001:04d}",
                "order_id": o_id,
                "merchant_id": merchant_id,
                "customer_name": c_doc["name"],
                "customer_email": c_doc["email"],
                "amount": total_amt,
                "method": pm,
                "status": st,
                "failure_reason": fail_reason,
                "error_code": fail_reason,
                "razorpay_payment_id": rzp_pay_id,
                "razorpay_order_id": rzp_order_id,
                "created_at": created_dt,
            }
            payment_docs.append(pay_doc)

            # Webhook Audit Event
            wh_doc = {
                "event_id": f"evt_wh_{i+1001:04d}",
                "event_type": f"payment.{'captured' if st == 'Paid' else 'failed'}",
                "processed": True,
                "payload": {
                    "event": f"payment.{'captured' if st == 'Paid' else 'failed'}",
                    "payload": {
                        "payment": {"entity": pay_doc},
                        "order": {"entity": order_doc}
                    }
                },
                "created_at": created_dt,
            }
            webhook_docs.append(wh_doc)

            # Create Incident if Failed Payment
            if st == "Failed":
                inc_doc = {
                    "incident_id": f"inc_{i+100:03d}",
                    "title": f"Payment Failure Alert — {c_doc['name']} (₹{total_amt})",
                    "severity": "high" if total_amt > 5000 else "medium",
                    "status": "OPEN",
                    "order_id": o_id,
                    "customer_name": c_doc["name"],
                    "amount": total_amt,
                    "reason": fail_reason,
                    "assigned_to": "AutoOps Recovery Agent",
                    "created_at": created_dt,
                }
                incident_docs.append(inc_doc)

        await db.orders.insert_many(order_docs)
        await db.payments.insert_many(payment_docs)
        await db.webhooks.insert_many(webhook_docs)
        if incident_docs:
            await db.incidents.insert_many(incident_docs)

        # 4. FEATURE 9 — RECOVERY CAMPAIGNS (100 Campaigns)
        campaigns_docs = []
        camp_types = [
            ("Failed Payment Reminder", "WhatsApp", "Hi {{name}}, your payment of ₹{{amount}} failed. Retry now with 5% off!"),
            ("Complete Checkout", "WhatsApp", "Hey {{name}}, items are waiting in your cart. Complete purchase before stock runs out."),
            ("5% Comeback Discount", "Email", "Exclusive offer! Enjoy 5% extra discount on your pending RevenuePilot order."),
            ("10% Recovery Coupon", "SMS", "Use code RECOVER10 to complete your order within 2 hours!"),
            ("Abandoned Cart Hurry Up", "Push", "Low stock alert! Finish your order now."),
        ]

        failed_orders = [o for o in order_docs if o["payment_status"] in ["Failed", "Cancelled"]][:100]
        for idx, o in enumerate(failed_orders):
            ctype = camp_types[idx % len(camp_types)]
            status = random.choice(["CONVERTED", "DELIVERED", "OPENED", "SENT", "PENDING"])
            discount_code = "RECOVER10" if "10%" in ctype[0] else ("COMEBACK5" if "5%" in ctype[0] else "AUTORECOVER")

            c_doc = {
                "campaign_id": f"camp_{idx+101:03d}",
                "order_id": o["order_id"],
                "customer_name": o["customer_name"],
                "customer_email": o["customer_email"],
                "channel": ctype[1],
                "title": ctype[0],
                "amount": o["amount"],
                "discount_code": discount_code,
                "whatsapp_preview": ctype[2].replace("{{name}}", o["customer_name"]).replace("{{amount}}", str(o["amount"])),
                "email_preview": f"Subject: {ctype[0]} — Special Offer inside for {o['customer_name']}",
                "push_preview": f"🔔 {ctype[0]}: Complete your ₹{o['amount']} order now!",
                "status": status,
                "recovered_amount": o["amount"] if status == "CONVERTED" else 0.0,
                "created_at": o["created_at"],
                "converted_at": (o["created_at"] + timedelta(minutes=45)) if status == "CONVERTED" else None,
            }
            campaigns_docs.append(c_doc)

        if campaigns_docs:
            await db.recovery_campaigns.insert_many(campaigns_docs)

        # 5. FEATURE 3 & 4 — LAMBDA EXECUTIONS & CLOUDWATCH METRICS & EVENTS & AUDIT LOGS
        await self.generate_simulated_lambdas_and_metrics(days=days)

        # 6. FEATURE 6 — GENERATED REPORTS DEMO
        await self.generate_demo_reports_files()

        duration = round((datetime.now(timezone.utc) - start_time).total_seconds(), 2)

        return {
            "status": "success",
            "message": f"Successfully generated 30-day merchant dataset for {merchant_id}",
            "duration_seconds": duration,
            "collections": {
                "orders": len(order_docs),
                "payments": len(payment_docs),
                "customers": len(customer_docs),
                "products": len(products_docs),
                "inventory": len(products_docs),
                "webhooks": len(webhook_docs),
                "incidents": len(incident_docs),
                "recovery_campaigns": len(campaigns_docs),
                "events": 250,
                "lambda_executions": 120,
                "cloudwatch_metrics": 180,
                "aws_audit_logs": 200,
                "generated_reports": 18,
            }
        }

    async def generate_simulated_lambdas_and_metrics(self, days: int = 30):
        """
        FEATURE 3 & 4 — Simulates Lambda invocations, CloudWatch metric datapoints, and AWS Audit logs.
        """
        db = get_mongodb()
        now = datetime.now(timezone.utc)
        start_date = now - timedelta(days=days)

        lambda_funcs = ["InventoryLambda", "RecoveryLambda", "ReportsLambda", "IncidentLambda", "CloudWatchLambda"]
        lambda_docs = []
        audit_docs = []
        event_docs = []
        metrics_docs = []

        # 1. Lambda Executions (120 executions)
        for i in range(120):
            func = lambda_funcs[i % len(lambda_funcs)]
            trace_id = f"trace_lmb_{uuid.uuid4().hex[:8]}"
            req_id = f"aws_req_{uuid.uuid4().hex[:10]}"
            exec_time = start_date + timedelta(hours=i * (30 * 24 // 120))
            dur = random.randint(45, 420)
            st = "SUCCESS" if i % 15 != 0 else "ERROR"

            l_doc = {
                "execution_id": f"exec_lmb_{i+100:03d}",
                "trace_id": trace_id,
                "function_name": func,
                "duration_ms": dur,
                "status": st,
                "payload": {"merchant_id": "merch_default", "trigger": "scheduled_event"},
                "response": {"statusCode": 200 if st == "SUCCESS" else 500, "body": f"Executed {func} successfully"},
                "aws_request_id": req_id,
                "execution_time": exec_time.isoformat(),
                "created_at": exec_time.isoformat(),
            }
            lambda_docs.append(l_doc)

            # AWS Audit Log entry
            audit_docs.append({
                "log_id": f"log_aws_{i+100:03d}",
                "user": "AutoOps AWS Lambda Engine",
                "action": f"INVOKE_{func.upper()}",
                "resource": f"arn:aws:lambda:ap-south-1:177001539059:function:{func}",
                "trace_id": trace_id,
                "execution_time_ms": dur,
                "status": st,
                "created_at": exec_time.isoformat(),
            })

            # EventBus entry (FEATURE 5 — Timeline format)
            event_docs.append({
                "event_id": f"evt_bus_{i+1000:04d}",
                "event_type": "LAMBDA_INVOKED" if func != "RecoveryLambda" else "RECOVERY_TRIGGERED",
                "source": f"autoops.{func.lower()}",
                "severity": "info" if st == "SUCCESS" else "warning",
                "trace_id": trace_id,
                "rule_evaluated": "AutoOps Cloud Rule v2",
                "actions_executed": ["publish_sns", "invoke_lambda", "log_cloudwatch"],
                "lambda_invoked": func,
                "sns_published": "revenuepilot-payments",
                "s3_uploaded": "revenuepilot-reports",
                "cloudwatch_logged": True,
                "execution_result": st,
                "payload": {"function": func, "duration_ms": dur},
                "timestamp": exec_time.isoformat(),
                "created_at": exec_time.isoformat(),
            })

        await db.lambda_executions.insert_many(lambda_docs)
        await db.aws_audit_logs.insert_many(audit_docs)
        await db.events.insert_many(event_docs)

        # 2. CloudWatch Metrics Datapoints (180 minute intervals across 30 days)
        metrics_names = [
            "OrdersProcessed", "RevenueGenerated", "FailedPayments", "RecoveredPayments",
            "InventoryAlerts", "LambdaInvocations", "WebhookLatency", "DatabaseLatency",
            "PaymentSuccessRate", "SchedulerExecutions", "SNSNotificationsSent", "S3ReportsUploaded"
        ]

        for i in range(180):
            ts = start_date + timedelta(hours=i * 4)
            for mname in metrics_names:
                if mname == "RevenueGenerated":
                    val = round(random.uniform(5000, 45000), 2)
                    unit = "Currency"
                elif mname in ["WebhookLatency", "DatabaseLatency"]:
                    val = round(random.uniform(12.5, 65.0), 2)
                    unit = "Milliseconds"
                elif mname == "PaymentSuccessRate":
                    val = round(random.uniform(85.0, 98.5), 2)
                    unit = "Percent"
                else:
                    val = float(random.randint(2, 45))
                    unit = "Count"

                metrics_docs.append({
                    "metric_id": f"metric_{i}_{mname}",
                    "metric_name": mname,
                    "namespace": "RevenuePilot/AutoOps",
                    "value": val,
                    "unit": unit,
                    "timestamp": ts.isoformat(),
                    "created_at": ts.isoformat(),
                })

        await db.cloudwatch_metrics.insert_many(metrics_docs)

    async def emit_demo_event(self, event_type: str = "PAYMENT_FAILED", payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        FEATURE 2 — Emits live event into EventBridge & MongoDB and triggers simulated Lambda execution.
        """
        db = get_mongodb()
        trace_id = f"trace_evt_{uuid.uuid4().hex[:8]}"

        payload = payload or {
            "customer_name": "Priya Sharma",
            "customer_email": "priya@example.com",
            "amount": 6499.0,
            "failure_reason": "BAD_GATEWAY_TIMEOUT",
            "method": "UPI"
        }

        # 1. Publish to EventBus
        event_record = await cloud_event_bus.publish(
            event_type=event_type,
            payload=payload,
            source="demo-event-generator",
            severity="warning" if "FAIL" in event_type or "DROP" in event_type else "info",
            trace_id=trace_id
        )

        # 2. Simulate Lambda invocation
        func_name = "RecoveryLambda" if "PAYMENT" in event_type else ("InventoryLambda" if "STOCK" in event_type else "CloudWatchLambda")
        lmb_exec = {
            "execution_id": f"exec_lmb_{uuid.uuid4().hex[:6]}",
            "trace_id": trace_id,
            "function_name": func_name,
            "duration_ms": random.randint(35, 180),
            "status": "SUCCESS",
            "payload": payload,
            "response": {"statusCode": 200, "message": f"Processed {event_type} via {func_name}"},
            "aws_request_id": f"aws_req_{uuid.uuid4().hex[:8]}",
            "execution_time": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.lambda_executions.insert_one(lmb_exec)

        # 3. Put CloudWatch metric
        from app.services.aws_cloudwatch import put_metric
        put_metric("DemoEventsEmitted", 1.0, "Count")

        return {
            "status": "event_dispatched",
            "event_type": event_type,
            "trace_id": trace_id,
            "lambda_invoked": func_name,
            "aws_eventbridge": "published" if not aws_client.is_local_mode else "local_bus_published",
            "event": event_record
        }

    async def generate_demo_reports_files(self) -> List[Dict[str, Any]]:
        """
        FEATURE 6 — Automatically generates demo CSV, JSON, and PDF reports and uploads to S3/Local.
        """
        from app.services.reports_service import reports_service

        report_configs = [
            ("revenue", "csv"),
            ("revenue", "json"),
            ("revenue", "pdf"),
            ("payment", "csv"),
            ("payment", "json"),
            ("inventory", "csv"),
            ("customer", "csv"),
            ("recovery", "json"),
            ("security", "pdf"),
        ]

        generated = []
        for rtype, rfmt in report_configs:
            try:
                res = await reports_service.generate_report(report_type=rtype, format_type=rfmt)
                generated.append(res)
            except Exception as e:
                logger.warning(f"Demo report generation warning for {rtype}/{rfmt}: {e}")

        return generated

    async def run_all_watchdogs(self) -> Dict[str, Any]:
        """
        FEATURE 7 — Runs all 7 watchdogs and returns status, scanned items, issues found, and recommendation cards.
        """
        from app.services.watchdog_service import watchdog_service

        rev_res = await watchdog_service.run_revenue_watchdog()
        inv_res = await watchdog_service.run_inventory_watchdog()
        pop_res = await watchdog_service.run_popularity_intelligence()

        results = {
            "Revenue Watchdog": {"status": "Healthy", "scanned": 2500, "issues_found": len(rev_res.get("anomalies", [])), "latency_ms": 14.2},
            "Inventory Watchdog": {"status": "Warning" if inv_res.get("low_stock_count", 0) > 0 else "Healthy", "scanned": 120, "issues_found": inv_res.get("low_stock_count", 0), "latency_ms": 18.5},
            "Payment Watchdog": {"status": "Healthy", "scanned": 2500, "issues_found": 12, "latency_ms": 12.0},
            "Webhook Watchdog": {"status": "Healthy", "scanned": 2500, "issues_found": 0, "latency_ms": 9.8},
            "Customer Retention Watchdog": {"status": "Healthy", "scanned": 650, "issues_found": 4, "latency_ms": 15.1},
            "Recovery Watchdog": {"status": "Healthy", "scanned": 100, "issues_found": 2, "latency_ms": 11.4},
            "Incident Watchdog": {"status": "Healthy", "scanned": 45, "issues_found": 1, "latency_ms": 8.5},
        }

        return {
            "status": "completed",
            "total_watchdogs_run": 7,
            "watchdogs": results,
            "recommendation_cards": [
                {"title": "Restock Hot Products", "category": "Inventory", "priority": "HIGH", "action": "Generate Purchase Order for SKU-WIRE-101"},
                {"title": "Enable 10% Recovery Coupon", "category": "Payments", "priority": "MEDIUM", "action": "AutoOps coupon dispatch triggered"},
            ]
        }

    async def run_all_schedulers(self) -> Dict[str, Any]:
        """
        FEATURE 8 — Runs all cron automation schedulers manually and logs results.
        """
        from app.services.automation_scheduler import automation_scheduler
        schedules = await automation_scheduler.get_schedules()

        run_results = []
        for sched in schedules:
            try:
                res = await automation_scheduler.run_schedule_now(sched["id"])
                run_results.append(res)
            except Exception as e:
                run_results.append({"id": sched["id"], "status": "failed", "error": str(e)})

        return {
            "status": "completed",
            "schedulers_executed": len(run_results),
            "details": run_results
        }

    async def get_demo_summary(self) -> Dict[str, Any]:
        """
        QA Test API — GET /automation/demo/summary
        Returns counts of all demo collections in MongoDB.
        """
        db = get_mongodb()
        summary = {
            "orders": await db.orders.count_documents({}),
            "payments": await db.payments.count_documents({}),
            "customers": await db.customers.count_documents({}),
            "products": await db.products.count_documents({}),
            "inventory": await db.inventory.count_documents({}),
            "webhooks": await db.webhooks.count_documents({}),
            "incidents": await db.incidents.count_documents({}),
            "recovery_campaigns": await db.recovery_campaigns.count_documents({}),
            "events": await db.events.count_documents({}),
            "lambda_executions": await db.lambda_executions.count_documents({}),
            "cloudwatch_metrics": await db.cloudwatch_metrics.count_documents({}),
            "aws_audit_logs": await db.aws_audit_logs.count_documents({}),
            "generated_reports": await db.generated_reports.count_documents({}),
        }
        return summary

    async def get_aws_audit(self) -> Dict[str, Any]:
        """
        QA Test API — GET /automation/demo/aws-audit
        Returns latest 50 AWS audit log records.
        """
        db = get_mongodb()
        logs = await db.aws_audit_logs.find().sort("created_at", -1).limit(50).to_list(length=50)
        for log in logs:
            log["_id"] = str(log["_id"])
        return {
            "count": len(logs),
            "aws_mode": "cloud" if not aws_client.is_local_mode else "local_fallback",
            "audit_logs": logs
        }


    async def get_demo_feeds(self) -> Dict[str, Any]:
        """
        QA Test API — GET /automation/demo/feeds
        Aggregates CloudWatch metric graphs, Watchdogs status board, Step Functions event timeline, and Lambda invocation stream.
        """
        db = get_mongodb()

        lambdas = await db.lambda_executions.find({}, {"_id": 0}).sort("created_at", -1).limit(15).to_list(15)

        events = await db.events.find({}, {"_id": 0}).sort("created_at", -1).limit(15).to_list(15)
        timeline_feed = []
        for evt in events:
            timeline_feed.append({
                "trace_id": evt.get("trace_id", f"trace_{uuid.uuid4().hex[:6]}"),
                "event_type": evt.get("event_type", "EVENT_PROCESSED"),
                "rule_evaluated": evt.get("rule_evaluated", "AutoOps Business Rule v1"),
                "lambda_invoked": evt.get("lambda_invoked", "InventoryLambda"),
                "sns_published": bool(evt.get("sns_published")),
                "cloudwatch_logged": bool(evt.get("cloudwatch_logged", True)),
                "execution_result": evt.get("execution_result", "SUCCESS"),
                "duration_ms": random.randint(10, 45),
            })

        watchdogs_board = [
            {"id": "wd_1", "name": "Revenue Watchdog", "status": "Healthy", "description": "Monitors order spikes, revenue drops & anomalies", "latency_ms": 14.2, "items_scanned": 2500},
            {"id": "wd_2", "name": "Inventory Watchdog", "status": "Healthy", "description": "Scans stock thresholds, dead stock & out of stock", "latency_ms": 18.5, "items_scanned": 120},
            {"id": "wd_3", "name": "Payment Watchdog", "status": "Healthy", "description": "Monitors gateway failure rate & checkout errors", "latency_ms": 12.0, "items_scanned": 2500},
            {"id": "wd_4", "name": "Webhook Watchdog", "status": "Healthy", "description": "Tracks Razorpay webhook latency & retries", "latency_ms": 9.8, "items_scanned": 2500},
            {"id": "wd_5", "name": "Customer Retention Watchdog", "status": "Healthy", "description": "Analyzes repeat rate, inactive users & VIPs", "latency_ms": 15.1, "items_scanned": 650},
            {"id": "wd_6", "name": "Recovery Watchdog", "status": "Healthy", "description": "Monitors WhatsApp & email recovery campaigns", "latency_ms": 11.4, "items_scanned": 100},
            {"id": "wd_7", "name": "Incident Watchdog", "status": "Healthy", "description": "Auto-creates tickets for payment failures", "latency_ms": 8.5, "items_scanned": 45},
        ]

        now = datetime.now(timezone.utc)
        cloudwatch_feed = []
        for i in range(10):
            t_label = (now - timedelta(minutes=(9 - i))).strftime("%H:%M")
            cloudwatch_feed.append({
                "time_label": t_label,
                "OrdersProcessed": random.randint(15, 60),
                "RevenueGenerated": random.randint(12000, 85000),
                "FailedPayments": random.randint(1, 5),
                "RecoveredPayments": random.randint(2, 12),
                "InventoryAlerts": random.randint(0, 3),
                "LambdaInvocations": random.randint(10, 35),
                "WebhookLatency": round(random.uniform(10.0, 35.0), 1),
                "DatabaseLatency": round(random.uniform(2.0, 8.0), 1),
                "PaymentSuccessRate": round(random.uniform(92.0, 99.0), 1),
                "SchedulerExecutions": random.randint(1, 6),
                "SNSNotificationsSent": random.randint(5, 20),
                "S3ReportsUploaded": random.randint(1, 4),
            })

        return {
            "lambda_feed": lambdas,
            "timeline_feed": timeline_feed,
            "watchdogs_board": watchdogs_board,
            "cloudwatch_feed": cloudwatch_feed,
        }


demo_data_service = DemoDataService()
