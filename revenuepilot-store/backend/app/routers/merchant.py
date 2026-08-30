from typing import List
from fastapi import APIRouter, Depends
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.models.webhook import WebhookEvent
from app.schemas.merchant import RevenueSummaryOut
from app.api.deps import require_merchant

router = APIRouter(prefix="/merchant", tags=["Merchant & AI Integration APIs"])

@router.get("/orders")
async def get_merchant_orders(limit: int = 100, skip: int = 0, _current_user: User = Depends(require_merchant)):
    orders = await Order.find_all().sort("-created_at").skip(skip).limit(limit).to_list()
    if not orders:
        return []

    # Batch fetch users to eliminate N+1 queries
    from bson import ObjectId
    user_ids = {o.user_id for o in orders if o.user_id}
    obj_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
    email_ids = [uid for uid in user_ids if not ObjectId.is_valid(uid)]

    users_by_id = {}
    if obj_ids:
        docs = await User.find({"_id": {"$in": obj_ids}}).to_list()
        for u in docs:
            users_by_id[str(u.id)] = u
    if email_ids:
        docs = await User.find({"email": {"$in": email_ids}}).to_list()
        for u in docs:
            users_by_id[u.email] = u

    result = []
    for o in orders:
        user_doc = users_by_id.get(o.user_id)
        customer_name = user_doc.name if user_doc and user_doc.name else f"Customer {o.user_id[-6:] if o.user_id else ''}"
        customer_email = user_doc.email if user_doc and user_doc.email else ""

        result.append({
            "order_id": o.order_id,
            "user_id": o.user_id,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "items_count": len(o.items),
            "total_amount": o.total_amount,
            "currency": o.currency,
            "razorpay_order_id": o.razorpay_order_id,
            "payment_status": o.payment_status,
            "order_status": o.order_status,
            "created_at": o.created_at.isoformat()
        })
    return result

@router.get("/payments")
async def get_merchant_payments(limit: int = 100, skip: int = 0, _current_user: User = Depends(require_merchant)):
    payments = await Payment.find_all().sort("-created_at").skip(skip).limit(limit).to_list()
    if not payments:
        return []

    # Batch fetch orders and users
    from bson import ObjectId
    order_ids = {p.order_id for p in payments if p.order_id}
    matched_orders = await Order.find({"$or": [{"order_id": {"$in": list(order_ids)}}, {"razorpay_order_id": {"$in": list(order_ids)}}]}).to_list()
    
    orders_map = {}
    user_ids = set()
    for ord_doc in matched_orders:
        orders_map[ord_doc.order_id] = ord_doc
        if ord_doc.razorpay_order_id:
            orders_map[ord_doc.razorpay_order_id] = ord_doc
        if ord_doc.user_id:
            user_ids.add(ord_doc.user_id)

    obj_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
    email_ids = [uid for uid in user_ids if not ObjectId.is_valid(uid)]

    users_by_id = {}
    if obj_ids:
        docs = await User.find({"_id": {"$in": obj_ids}}).to_list()
        for u in docs:
            users_by_id[str(u.id)] = u
    if email_ids:
        docs = await User.find({"email": {"$in": email_ids}}).to_list()
        for u in docs:
            users_by_id[u.email] = u

    result = []
    for p in payments:
        user_name = "Customer"
        user_email = ""
        order = orders_map.get(p.order_id)
        if order and order.user_id:
            user_doc = users_by_id.get(order.user_id)
            if user_doc:
                user_name = user_doc.name or "Customer"
                user_email = user_doc.email or ""

        result.append({
            "payment_id": p.payment_id,
            "order_id": p.order_id,
            "razorpay_payment_id": p.razorpay_payment_id,
            "customer_name": user_name,
            "customer_email": user_email,
            "amount": p.amount,
            "method": p.method,
            "status": p.status,
            "failure_reason": p.failure_reason,
            "error_code": p.error_code,
            "created_at": p.created_at.isoformat()
        })
    return result

@router.get("/customers")
async def get_merchant_customers(limit: int = 100, skip: int = 0, _current_user: User = Depends(require_merchant)):
    # Only return actual customers, never merchant/admin accounts
    users = await User.find(User.role == "customer").sort("-created_at").skip(skip).limit(limit).to_list()
    return [
        {
            "user_id": str(u.id),
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "created_at": u.created_at.isoformat()
        } for u in users
    ]

@router.get("/revenue-summary", response_model=RevenueSummaryOut)
@router.get("/summary", response_model=RevenueSummaryOut)
async def get_merchant_revenue_summary(_current_user: User = Depends(require_merchant)):
    all_orders = await Order.find_all().to_list()
    total_orders = len(all_orders)

    paid_orders_list     = [o for o in all_orders if o.payment_status == "Paid"]
    failed_orders_list   = [o for o in all_orders if o.payment_status == "Failed"]
    cancelled_orders_list= [o for o in all_orders if o.payment_status == "Cancelled"]
    pending_orders_list  = [o for o in all_orders if o.payment_status == "Pending"]

    paid_count       = len(paid_orders_list)
    failed_count     = len(failed_orders_list)
    cancelled_count  = len(cancelled_orders_list)
    pending_count    = len(pending_orders_list)
    total_revenue    = round(sum(o.total_amount for o in paid_orders_list), 2)

    # Success rate = paid / (paid + failed), excluding pending and cancelled
    terminal_count = paid_count + failed_count
    success_rate = round((paid_count / terminal_count) * 100, 2) if terminal_count > 0 else 0.0
    failure_rate = round((failed_count / terminal_count) * 100, 2) if terminal_count > 0 else 0.0

    return RevenueSummaryOut(
        total_orders=total_orders,
        total_revenue=total_revenue,
        paid_orders=paid_count,
        failed_payments=failed_count,
        cancelled_orders=cancelled_count,
        pending_orders=pending_count,
        payment_success_rate=success_rate,
        failure_rate=failure_rate,
    )

@router.get("/events")
async def get_merchant_events(limit: int = 100, skip: int = 0, _current_user: User = Depends(require_merchant)):
    events = await WebhookEvent.find_all().sort("-created_at").skip(skip).limit(limit).to_list()
    return [
        {
            "event_id": e.event_id,
            "event_type": e.event_type,
            "processed": e.processed,
            "payload_summary": {
                "event": e.payload.get("event"),
                "contains_payment": "payment" in e.payload.get("payload", {})
            },
            "created_at": e.created_at.isoformat()
        } for e in events
    ]
