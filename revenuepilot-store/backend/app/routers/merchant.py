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
    orders = await Order.find(Order.merchant_id == _current_user.merchant_id).sort("-created_at").skip(skip).limit(limit).to_list()
    result = []
    for o in orders:
        user_doc = None
        try:
            from bson import ObjectId
            if ObjectId.is_valid(o.user_id):
                user_doc = await User.get(ObjectId(o.user_id))
            if not user_doc:
                user_doc = await User.find_one(User.email == o.user_id)
        except Exception:
            pass

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
    payments = await Payment.find(Payment.merchant_id == _current_user.merchant_id).sort("-created_at").skip(skip).limit(limit).to_list()
    result = []
    for p in payments:
        user_name = "Customer"
        user_email = ""
        if p.order_id:
            order = await Order.find_one(Order.order_id == p.order_id)
            if not order:
                order = await Order.find_one(Order.razorpay_order_id == p.order_id)
            if order and order.user_id:
                try:
                    from bson import ObjectId
                    user_doc = None
                    if ObjectId.is_valid(order.user_id):
                        user_doc = await User.get(ObjectId(order.user_id))
                    if not user_doc:
                        user_doc = await User.find_one(User.email == order.user_id)
                    if user_doc:
                        user_name = user_doc.name or "Customer"
                        user_email = user_doc.email or ""
                except Exception:
                    pass

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
    users = await User.find(User.merchant_id == _current_user.merchant_id).sort("-created_at").skip(skip).limit(limit).to_list()
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
    all_orders = await Order.find(Order.merchant_id == _current_user.merchant_id).to_list()
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
