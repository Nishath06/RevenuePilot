from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional
from app.db.mongodb import get_collection, get_mongodb
import asyncio
import math

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

def _get_kolkata_date_filter(field_name: str, period: str) -> dict:
    if period == "all":
        return {}
    try:
        tz = ZoneInfo("Asia/Kolkata")
    except Exception:
        tz = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(tz)
    
    if period == "today":
        start_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0, tzinfo=tz)
    elif period == "week":
        monday_ist = now_ist - timedelta(days=now_ist.weekday())
        start_ist = datetime(monday_ist.year, monday_ist.month, monday_ist.day, 0, 0, 0, tzinfo=tz)
    elif period == "month":
        start_ist = datetime(now_ist.year, now_ist.month, 1, 0, 0, 0, tzinfo=tz)
    else:
        return {}
        
    start_utc = start_ist.astimezone(timezone.utc)
    start_iso = start_utc.isoformat()
    return {
        "$or": [
            {field_name: {"$gte": start_utc}},
            {field_name: {"$gte": start_iso}}
        ]
    }

async def _base_orders_pipeline(status: str, period: str, filter_recovered: bool = False) -> list[dict[str, Any]]:
    col = get_collection("orders")
    
    match_stage = {"payment_status": status}
    date_flt = _get_kolkata_date_filter("created_at", period)
    if date_flt:
        match_stage.update(date_flt)
    
    pipeline = [
        {"$match": match_stage},
        {"$sort": {"created_at": -1}},
        # Lookup user profile
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_doc"
            }
        },
        {"$unwind": {"path": "$user_doc", "preserveNullAndEmptyArrays": True}},
        # Lookup payment details
        {
            "$lookup": {
                "from": "payments",
                "localField": "order_id",
                "foreignField": "order_id",
                "as": "pay_doc"
            }
        },
        {"$unwind": {"path": "$pay_doc", "preserveNullAndEmptyArrays": True}}
    ]

    if filter_recovered:
        pipeline.extend([
            {
                "$lookup": {
                    "from": "orders",
                    "let": {"failed_uid": "$user_id", "failed_at": "$created_at"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$user_id", "$$failed_uid"]},
                                        {"$eq": ["$payment_status", "Paid"]},
                                        {"$gt": ["$created_at", "$$failed_at"]}
                                    ]
                                }
                            }
                        },
                        {"$limit": 1}
                    ],
                    "as": "subsequent_paid"
                }
            },
            {"$match": {"subsequent_paid": {"$size": 0}}}
        ])

    pipeline.append({
        "$project": {
            "order_id": 1,
            "created_at": 1,
            "total_amount": {"$ifNull": ["$total_amount", 0.0]},
            "user_id": 1,
            "customer_name": {"$ifNull": ["$user_doc.name", {"$ifNull": ["$customer_name", {"$ifNull": ["$name", "Customer"]}]}]},
            "customer_email": {"$ifNull": ["$user_doc.email", {"$ifNull": ["$customer_email", ""]}]},
            "customer_phone": {"$ifNull": ["$user_doc.phone", {"$ifNull": ["$customer_phone", ""]}]},
            "failure_reason": {"$ifNull": ["$pay_doc.failure_reason", "Payment execution failed"]},
            "error_code": {"$ifNull": ["$pay_doc.error_code", "FAILED"]}
        }
    })

    return await col.aggregate(pipeline).to_list(1000)

async def _base_carts_pipeline(period: str, filter_recovered: bool = False) -> list[dict[str, Any]]:
    col = get_collection("carts")
    
    cutoff = _utc_now() - timedelta(hours=1)
    match_stage = {"items": {"$exists": True, "$ne": []}, "updated_at": {"$lt": cutoff}}
    date_flt = _get_kolkata_date_filter("updated_at", period)
    if date_flt:
        match_stage.update(date_flt)
    
    pipeline = [
        {"$match": match_stage},
        {"$sort": {"subtotal": -1}},
        # Lookup user profile
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_doc"
            }
        },
        {"$unwind": {"path": "$user_doc", "preserveNullAndEmptyArrays": True}}
    ]

    if filter_recovered:
        pipeline.extend([
            {
                "$lookup": {
                    "from": "orders",
                    "let": {"cart_uid": "$user_id", "cart_at": "$updated_at"},
                    "pipeline": [
                        {
                            "$match": {
                                "$expr": {
                                    "$and": [
                                        {"$eq": ["$user_id", "$$cart_uid"]},
                                        {"$eq": ["$payment_status", "Paid"]},
                                        {"$gt": ["$created_at", "$$cart_at"]}
                                    ]
                                }
                            }
                        },
                        {"$limit": 1}
                    ],
                    "as": "subsequent_paid"
                }
            },
            {"$match": {"subsequent_paid": {"$size": 0}}}
        ])

    pipeline.append({
        "$project": {
            "user_id": 1,
            "updated_at": 1,
            "subtotal": {"$ifNull": ["$subtotal", 0.0]},
            "items_count": {"$size": {"$ifNull": ["$items", []]}},
            "customer_name": {"$ifNull": ["$user_doc.name", "Customer"]},
            "customer_email": {"$ifNull": ["$user_doc.email", ""]},
            "customer_phone": {"$ifNull": ["$user_doc.phone", ""]}
        }
    })

    return await col.aggregate(pipeline).to_list(1000)

async def get_failed_orders(period: str) -> list[dict]:
    return await _base_orders_pipeline("Failed", period, filter_recovered=False)

async def get_cancelled_orders(period: str) -> list[dict]:
    return await _base_orders_pipeline("Cancelled", period, filter_recovered=False)

async def get_abandoned_carts(period: str) -> list[dict]:
    return await _base_carts_pipeline(period, filter_recovered=False)

async def get_recoverable_failed_orders(period: str) -> list[dict]:
    return await _base_orders_pipeline("Failed", period, filter_recovered=True)

async def get_recoverable_cancelled_orders(period: str) -> list[dict]:
    return await _base_orders_pipeline("Cancelled", period, filter_recovered=True)

async def get_recoverable_abandoned_carts(period: str) -> list[dict]:
    return await _base_carts_pipeline(period, filter_recovered=True)

async def _enrich_candidate(item: dict, item_type: str) -> dict:
    """Enriches item with candidate metadata and MongoDB persistence."""
    db = get_mongodb()
    cand_col = db.recovery_candidates
    orders_col = db.orders

    raw_id = item.get("order_id") or f"cart_{item.get('user_id')}"
    candidate_id = str(raw_id)
    user_id = item.get("user_id", "")
    amount = float(item.get("total_amount") or item.get("subtotal") or 0.0)
    customer_name = item.get("customer_name", "Customer")
    customer_email = item.get("customer_email", "")
    customer_phone = item.get("customer_phone", "")
    failure_reason = item.get("failure_reason", "Checkout Abandoned" if item_type == "abandoned" else "Payment Failed")
    created_at = item.get("created_at") or item.get("updated_at")
    created_at_str = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or "")

    # Calculate LTV & Previous orders for customer
    ltv = 0.0
    previous_orders = 0
    if user_id:
        paid_agg = await orders_col.aggregate([
            {"$match": {"user_id": user_id, "payment_status": "Paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}, "cnt": {"$sum": 1}}}
        ]).to_list(1)
        if paid_agg:
            ltv = float(paid_agg[0].get("total", 0.0))
            previous_orders = int(paid_agg[0].get("cnt", 0))

    # Priority & Segment logic
    if amount > 5000 or ltv > 10000:
        priority = "CRITICAL"
    elif amount > 2000 or ltv > 5000:
        priority = "HIGH"
    else:
        priority = "MEDIUM"

    if ltv > 15000:
        segment = "VIP"
    elif previous_orders >= 3:
        segment = "LOYAL"
    elif amount > 3000:
        segment = "HIGH_VALUE"
    elif ltv > 0:
        segment = "AT_RISK"
    else:
        segment = "NEW"

    recovery_score = min(95, max(65, int(70 + (amount / 200) + (previous_orders * 5))))
    confidence = round(0.75 + (previous_orders * 0.05), 2)
    coupon_code = "RECOVER15" if amount > 1500 else "RECOVER10"
    recommended_discount = 15 if amount > 1500 else 10

    days_since_failure = 0
    try:
        if hasattr(created_at, "timestamp"):
            dt_obj = created_at
        else:
            dt_obj = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
        if dt_obj.tzinfo is None:
            dt_obj = dt_obj.replace(tzinfo=timezone.utc)
        diff = datetime.now(timezone.utc) - dt_obj
        days_since_failure = max(0, diff.days)
    except Exception:
        days_since_failure = 0

    reasoning = f"Customer has ₹{ltv:.0f} LTV with {previous_orders} past purchases. High likelihood of recovery using {recommended_discount}% off coupon code {coupon_code}."
    
    wa_msg = f"Hi {customer_name}! 👋 Your purchase of ₹{amount:.0f} was incomplete ({failure_reason}). Use code {coupon_code} for {recommended_discount}% off: https://store.revenuepilot.app/checkout"
    email_msg = f"Subject: Complete your order with {recommended_discount}% off!\nHi {customer_name},\nWe noticed your transaction of ₹{amount:.0f} was not completed due to '{failure_reason}'. Use code {coupon_code} to save {recommended_discount}% on your order now!"

    # Fetch existing document if present
    existing_doc = await cand_col.find_one({"candidate_id": candidate_id}, {"_id": 0})

    if not existing_doc:
        default_doc = {
            "candidate_id": candidate_id,
            "order_id": item.get("order_id", ""),
            "user_id": user_id,
            "merchant_id": "merch_default",
            "customer_name": customer_name,
            "customer_email": customer_email,
            "customer_phone": customer_phone,
            "amount": amount,
            "failure_reason": failure_reason,
            "error_code": item.get("error_code", "FAILED"),
            "created_at": created_at_str,
            "type": item_type,
            "priority": priority,
            "segment": segment,
            "recovery_score": recovery_score,
            "confidence": confidence,
            "coupon_code": coupon_code,
            "recommended_discount": recommended_discount,
            "days_since_failure": days_since_failure,
            "ltv": ltv,
            "previous_orders": previous_orders,
            "previous_attempts": 0,
            "reasoning": reasoning,
            "whatsapp_message": wa_msg,
            "email_message": email_msg,
            "edited_whatsapp_message": wa_msg,
            "edited_email_message": email_msg,
            "recovery_status": "PENDING",
            "email_sent_at": None,
            "sms_sent_at": None,
            "recovered_at": None,
            "last_action": "NONE",
            "last_action_by": "merchant_admin",
            "notes": "",
            "message_history": [
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "action": "Candidate Identified",
                    "by": "system",
                    "details": f"Candidate analyzed by Recovery AI with score {recovery_score}%"
                }
            ]
        }
        await cand_col.update_one({"candidate_id": candidate_id}, {"$setOnInsert": default_doc}, upsert=True)
        doc_data = default_doc
    else:
        doc_data = existing_doc

    # Merge dynamic attributes into result candidate payload
    res = dict(item)
    res.update({
        "candidate_id": candidate_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "customer_phone": customer_phone,
        "amount": amount,
        "failure_reason": failure_reason,
        "created_at": created_at_str,
        "type": item_type,
        "priority": doc_data.get("priority", priority),
        "segment": doc_data.get("segment", segment),
        "recovery_score": doc_data.get("recovery_score", recovery_score),
        "confidence": doc_data.get("confidence", confidence),
        "coupon_code": doc_data.get("coupon_code", coupon_code),
        "recommended_discount": doc_data.get("recommended_discount", recommended_discount),
        "days_since_failure": days_since_failure,
        "ltv": doc_data.get("ltv", ltv),
        "previous_orders": doc_data.get("previous_orders", previous_orders),
        "previous_attempts": len(doc_data.get("message_history", [])),
        "reasoning": doc_data.get("reasoning", reasoning),
        "whatsapp_message": doc_data.get("edited_whatsapp_message") or doc_data.get("whatsapp_message") or wa_msg,
        "email_message": doc_data.get("edited_email_message") or doc_data.get("email_message") or email_msg,
        "recovery_status": doc_data.get("recovery_status", "PENDING"),
        "email_sent_at": doc_data.get("email_sent_at"),
        "sms_sent_at": doc_data.get("sms_sent_at"),
        "recovered_at": doc_data.get("recovered_at"),
        "last_action": doc_data.get("last_action", "NONE"),
        "last_action_by": doc_data.get("last_action_by", "merchant_admin"),
        "notes": doc_data.get("notes", ""),
        "message_history": doc_data.get("message_history", [])
    })
    return res

async def get_recoverable_orders(period: str) -> dict:
    f_raw, c_raw, a_raw = await asyncio.gather(
        get_recoverable_failed_orders(period),
        get_recoverable_cancelled_orders(period),
        get_recoverable_abandoned_carts(period)
    )

    f_tasks = [_enrich_candidate(item, "failed") for item in f_raw]
    c_tasks = [_enrich_candidate(item, "cancelled") for item in c_raw]
    a_tasks = [_enrich_candidate(item, "abandoned") for item in a_raw]

    f_enriched = await asyncio.gather(*f_tasks) if f_tasks else []
    c_enriched = await asyncio.gather(*c_tasks) if c_tasks else []
    a_enriched = await asyncio.gather(*a_tasks) if a_tasks else []

    # Filter out items whose recovery_status is RECOVERED (Feature 2)
    f_unrecovered = [i for i in f_enriched if i.get("recovery_status") != "RECOVERED"]
    c_unrecovered = [i for i in c_enriched if i.get("recovery_status") != "RECOVERED"]
    a_unrecovered = [i for i in a_enriched if i.get("recovery_status") != "RECOVERED"]

    # Calculate statistics for summary cards (Feature 3)
    failed_cnt = len(f_unrecovered)
    cancelled_cnt = len(c_unrecovered)
    abandoned_cnt = len(a_unrecovered)
    
    total_rev = (
        sum(float(i.get("amount", 0.0)) for i in f_unrecovered) +
        sum(float(i.get("amount", 0.0)) for i in c_unrecovered) +
        sum(float(i.get("subtotal") or i.get("amount", 0.0)) for i in a_unrecovered)
    )

    # Recovered count in period from recovery_candidates DB collection
    db = get_mongodb()
    date_flt = _get_kolkata_date_filter("recovered_at", period)
    recovered_query = {"recovery_status": "RECOVERED"}
    if date_flt:
        recovered_query.update(date_flt)
    recovered_cnt = await db.recovery_candidates.count_documents(recovered_query)

    total_candidates = failed_cnt + cancelled_cnt + abandoned_cnt + recovered_cnt
    success_rate = round((recovered_cnt / total_candidates * 100), 1) if total_candidates > 0 else 0.0

    return {
        "failed_orders": f_unrecovered,
        "cancelled_orders": c_unrecovered,
        "abandoned_carts": a_unrecovered,
        "failed_count": failed_cnt,
        "cancelled_count": cancelled_cnt,
        "abandoned_count": abandoned_cnt,
        "total_recoverable_amount": round(total_rev, 2),
        "recovered_count": recovered_cnt,
        "total_candidates_count": total_candidates,
        "success_rate_percentage": success_rate
    }
