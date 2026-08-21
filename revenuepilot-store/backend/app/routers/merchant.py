from typing import List
from fastapi import APIRouter
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.models.webhook import WebhookEvent
from app.schemas.merchant import RevenueSummaryOut

router = APIRouter(prefix="/merchant", tags=["Merchant & AI Integration APIs"])

@router.get("/orders")
async def get_merchant_orders(limit: int = 100, skip: int = 0):
    orders = await Order.find_all().sort("-created_at").skip(skip).limit(limit).to_list()
    return [
        {
            "order_id": o.order_id,
            "user_id": o.user_id,
            "items_count": len(o.items),
            "total_amount": o.total_amount,
            "currency": o.currency,
            "razorpay_order_id": o.razorpay_order_id,
            "payment_status": o.payment_status,
            "order_status": o.order_status,
            "created_at": o.created_at.isoformat()
        } for o in orders
    ]

@router.get("/payments")
async def get_merchant_payments(limit: int = 100, skip: int = 0):
    payments = await Payment.find_all().sort("-created_at").skip(skip).limit(limit).to_list()
    return [
        {
            "payment_id": p.payment_id,
            "order_id": p.order_id,
            "razorpay_payment_id": p.razorpay_payment_id,
            "amount": p.amount,
            "method": p.method,
            "status": p.status,
            "failure_reason": p.failure_reason,
            "created_at": p.created_at.isoformat()
        } for p in payments
    ]

@router.get("/customers")
async def get_merchant_customers(limit: int = 100, skip: int = 0):
    users = await User.find_all().sort("-created_at").skip(skip).limit(limit).to_list()
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
async def get_merchant_revenue_summary():
    all_orders = await Order.find_all().to_list()
    total_orders = len(all_orders)
    
    paid_orders_list = [o for o in all_orders if o.payment_status == "Paid"]
    paid_orders = len(paid_orders_list)
    total_revenue = round(sum(o.total_amount for o in paid_orders_list), 2)
    
    failed_payments = len([o for o in all_orders if o.payment_status == "Failed"])
    pending_orders = len([o for o in all_orders if o.payment_status == "Pending"])
    
    return RevenueSummaryOut(
        total_orders=total_orders,
        total_revenue=total_revenue,
        paid_orders=paid_orders,
        failed_payments=failed_payments,
        pending_orders=pending_orders
    )

@router.get("/events")
async def get_merchant_events(limit: int = 100, skip: int = 0):
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
