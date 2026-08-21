import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Header, status
from app.models.webhook import WebhookEvent
from app.models.order import Order
from app.models.payment import Payment
from app.services.razorpay import razorpay_service
from app.core.logging import logger

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature")
):
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")
    
    # 1. Verify Webhook Signature
    if not razorpay_service.verify_webhook_signature(body_str, x_razorpay_signature or ""):
        logger.warning("Invalid Razorpay webhook signature received.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature"
        )
        
    try:
        data = json.loads(body_str)
    except Exception as e:
        logger.error(f"Failed to parse webhook JSON payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    event_id = data.get("event_id") or data.get("payload", {}).get("payment", {}).get("entity", {}).get("id") or f"evt_{uuid.uuid4().hex[:12]}"
    event_type = data.get("event", "unknown")
    
    # 2. Prevent duplicate events (Idempotency)
    existing_event = await WebhookEvent.find_one(WebhookEvent.event_id == event_id)
    if existing_event:
        logger.info(f"Duplicate webhook event ignored: {event_id}")
        return {"status": "ignored", "reason": "duplicate_event", "event_id": event_id}
        
    logger.info(f"Processing webhook event: {event_type} (ID: {event_id})")
    
    # 3. Process event & update collections
    payload = data.get("payload", {})
    
    if event_type in ["payment.captured", "order.paid"]:
        payment_entity = payload.get("payment", {}).get("entity", {})
        rzp_order_id = payment_entity.get("order_id") or payload.get("order", {}).get("entity", {}).get("id")
        rzp_payment_id = payment_entity.get("id")
        
        if rzp_order_id:
            order = await Order.find_one(Order.razorpay_order_id == rzp_order_id)
            if order:
                order.payment_status = "Paid"
                order.order_status = "Paid"
                await order.save()
                logger.info(f"Order {order.order_id} marked as Paid via webhook.")
                
                # Check payment entry
                if rzp_payment_id:
                    payment = await Payment.find_one(Payment.razorpay_payment_id == rzp_payment_id)
                    if not payment:
                        payment = Payment(
                            payment_id=f"pay_{uuid.uuid4().hex[:12]}",
                            order_id=order.order_id,
                            razorpay_payment_id=rzp_payment_id,
                            amount=payment_entity.get("amount", order.total_amount * 100) / 100.0,
                            method=payment_entity.get("method", "card"),
                            status="captured",
                            created_at=datetime.now(timezone.utc)
                        )
                        await payment.insert()
                    else:
                        payment.status = "captured"
                        await payment.save()
                        
    elif event_type == "payment.failed":
        payment_entity = payload.get("payment", {}).get("entity", {})
        rzp_order_id = payment_entity.get("order_id")
        rzp_payment_id = payment_entity.get("id")
        failure_reason = payment_entity.get("error_description", "Payment failed")
        
        if rzp_order_id:
            order = await Order.find_one(Order.razorpay_order_id == rzp_order_id)
            if order:
                order.payment_status = "Failed"
                order.order_status = "Failed"
                await order.save()
                logger.info(f"Order {order.order_id} marked as Failed via webhook.")
                
                if rzp_payment_id:
                    payment = await Payment.find_one(Payment.razorpay_payment_id == rzp_payment_id)
                    if not payment:
                        payment = Payment(
                            payment_id=f"pay_{uuid.uuid4().hex[:12]}",
                            order_id=order.order_id,
                            razorpay_payment_id=rzp_payment_id,
                            amount=payment_entity.get("amount", order.total_amount * 100) / 100.0,
                            method=payment_entity.get("method", "card"),
                            status="failed",
                            failure_reason=failure_reason,
                            created_at=datetime.now(timezone.utc)
                        )
                        await payment.insert()
                    else:
                        payment.status = "failed"
                        payment.failure_reason = failure_reason
                        await payment.save()
                        
    # 4. Save webhook event for audit/idempotency
    webhook_log = WebhookEvent(
        event_id=event_id,
        event_type=event_type,
        payload=data,
        processed=True,
        created_at=datetime.now(timezone.utc)
    )
    await webhook_log.insert()
    
    return {"status": "success", "event_id": event_id, "event_type": event_type}
