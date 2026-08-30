import uuid
import time
import logging
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.models.user import User
from app.models.cart import Cart
from app.models.order import Order, OrderItem, PaymentEvent
from app.models.payment import Payment
from app.schemas.checkout import (
    CreateOrderRequest, VerifyPaymentRequest, PaymentStatusRequest,
    OrderOut, RazorpayOrderResponse,
)
from app.services.razorpay import razorpay_service
from app.core.config import settings
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="", tags=["Checkout & Orders"])

TERMINAL_STATES = {"Paid", "Failed", "Cancelled"}


async def _find_owned_order(order_reference: str, user_id: str) -> Order | None:
    order = await Order.find_one(
        Order.razorpay_order_id == order_reference,
        Order.user_id == user_id,
    )
    if order is None:
        order = await Order.find_one(Order.order_id == order_reference, Order.user_id == user_id)
    return order


@router.post("/checkout/create-order", response_model=RazorpayOrderResponse)
async def create_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user)
):
    # Prices and quantities must originate from the server-side cart, never the browser body.
    cart = await Cart.find_one(Cart.user_id == str(current_user.id))
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    items_to_order = [
        OrderItem(product_id=item.product_id, title=item.title, price=item.price,
                  image=item.image, quantity=item.quantity)
        for item in cart.items
    ]

    total_amount = round(sum(item.price * item.quantity for item in items_to_order), 2)
    order_id = f"ord_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    rzp_order = razorpay_service.create_order(
        amount=total_amount,
        currency="INR",
        receipt=order_id,
        notes={"order_id": order_id, "user_id": str(current_user.id)},
    )

    initial_event = PaymentEvent(
        status="Pending",
        timestamp=now,
        reason="Razorpay order created"
    )

    db_order = Order(
        order_id=order_id,
        user_id=str(current_user.id),
        items=items_to_order,
        total_amount=total_amount,
        currency="INR",
        razorpay_order_id=rzp_order["id"],
        payment_status="Pending",
        order_status="Pending",
        payment_events=[initial_event],
        created_at=now,
    )
    await db_order.insert()

    logger.info(
        "payment_event_timeline_initialized",
        order_id=order_id,
        razorpay_order_id=rzp_order["id"],
        status="Pending",
        user_id=str(current_user.id)
    )

    return RazorpayOrderResponse(
        order_id=db_order.order_id,
        razorpay_order_id=rzp_order["id"],
        amount=rzp_order["amount"],
        currency=rzp_order["currency"],
        key=settings.RAZORPAY_KEY_ID,
    )


@router.post("/checkout/verify-payment")
async def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user)
):
    t0 = time.monotonic()
    order = await _find_owned_order(req.razorpay_order_id, str(current_user.id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Immutability Check: reject overwriting terminal states
    if order.payment_status in TERMINAL_STATES:
        logger.info(
            "payment_immutability_blocked_verify",
            order_id=order.order_id,
            current_status=order.payment_status,
            requested_status="Paid"
        )
        return {
            "message": "Order already finalized.",
            "order_id": order.order_id,
            "payment_status": order.payment_status,
            "order_status": order.order_status
        }

    now = datetime.now(timezone.utc)
    is_valid = razorpay_service.verify_signature(
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        razorpay_signature=req.razorpay_signature
    )

    if not is_valid:
        order.payment_status = "Failed"
        order.order_status = "Failed"
        order.payment_events.append(PaymentEvent(
            status="Failed",
            timestamp=now,
            reason="Invalid HMAC signature"
        ))
        await order.save()

        payment = Payment(
            payment_id=f"pay_{uuid.uuid4().hex[:12]}",
            order_id=order.order_id,
            razorpay_payment_id=req.razorpay_payment_id,
            amount=order.total_amount,
            method="card",
            status="failed",
            failure_reason="Invalid signature",
            created_at=now
        )
        await payment.insert()
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    previous_status = order.payment_status
    order.payment_status = "Paid"
    order.order_status = "Paid"
    order.payment_events.append(PaymentEvent(
        status="Paid",
        timestamp=now,
        reason="HMAC SHA256 signature verified"
    ))
    await order.save()

    payment = Payment(
        payment_id=f"pay_{uuid.uuid4().hex[:12]}",
        order_id=order.order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        amount=order.total_amount,
        method="card",
        status="captured",
        created_at=now
    )
    await payment.insert()

    exec_time_ms = round((time.monotonic() - t0) * 1000, 2)
    logger.info(
        "payment_status_transition_success",
        order_id=order.order_id,
        razorpay_order_id=order.razorpay_order_id,
        previous_status=previous_status,
        new_status="Paid",
        execution_time_ms=exec_time_ms
    )

    cart = await Cart.find_one(Cart.user_id == str(current_user.id))
    if cart:
        cart.items = []
        cart.subtotal = 0.0
        await cart.save()

    return {
        "message": "Payment verified successfully",
        "order_id": order.order_id,
        "payment_status": "Paid",
        "order_status": "Paid"
    }


@router.post("/checkout/payment-status")
async def update_payment_status(
    req: PaymentStatusRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Production-grade immutable payment state machine.
    Enforces terminal states (Paid, Failed, Cancelled) and blocks overwrites.
    """
    t0 = time.monotonic()
    order = await _find_owned_order(req.razorpay_order_id, str(current_user.id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 🔒 IMMUTABILITY GUARD: Reject overwriting terminal states
    if order.payment_status in TERMINAL_STATES:
        logger.warning(
            "payment_immutability_blocked_update",
            order_id=order.order_id,
            razorpay_order_id=order.razorpay_order_id,
            current_status=order.payment_status,
            attempted_status=req.payment_status,
            reason=req.reason
        )
        return {
            "message": f"Order is already in terminal state '{order.payment_status}'. Overwrite blocked.",
            "order_id": order.order_id,
            "payment_status": order.payment_status,
            "order_status": order.order_status
        }

    now = datetime.now(timezone.utc)
    previous_status = order.payment_status

    if req.payment_status == "failed":
        order.payment_status = "Failed"
        order.order_status = "Failed"
        reason_text = req.reason or "Payment declined by gateway/bank"
        order.payment_events.append(PaymentEvent(
            status="Failed",
            timestamp=now,
            reason=reason_text,
            error_code=req.error_code
        ))
        await order.save()

        payment = Payment(
            payment_id=f"pay_{uuid.uuid4().hex[:12]}",
            order_id=order.order_id,
            razorpay_payment_id=req.razorpay_payment_id,
            amount=order.total_amount,
            method="razorpay",
            status="failed",
            failure_reason=reason_text,
            error_code=req.error_code,
            created_at=now,
        )
        await payment.insert()

        exec_time_ms = round((time.monotonic() - t0) * 1000, 2)
        logger.warning(
            "payment_status_transition_failed",
            order_id=order.order_id,
            razorpay_order_id=order.razorpay_order_id,
            previous_status=previous_status,
            new_status="Failed",
            error_code=req.error_code,
            reason=reason_text,
            execution_time_ms=exec_time_ms
        )

        return {
            "message": "Order marked as failed",
            "order_id": order.order_id,
            "payment_status": "Failed",
            "order_status": "Failed"
        }

    # payment_status == "cancelled"
    order.payment_status = "Cancelled"
    order.order_status = "Cancelled"
    reason_text = req.reason or "Customer closed Razorpay Checkout"
    order.payment_events.append(PaymentEvent(
        status="Cancelled",
        timestamp=now,
        reason=reason_text
    ))
    await order.save()

    payment = Payment(
        payment_id=f"pay_{uuid.uuid4().hex[:12]}",
        order_id=order.order_id,
        razorpay_payment_id=None,
        amount=order.total_amount,
        method="razorpay",
        status="cancelled",
        failure_reason=reason_text,
        created_at=now,
    )
    await payment.insert()

    exec_time_ms = round((time.monotonic() - t0) * 1000, 2)
    logger.info(
        "payment_status_transition_cancelled",
        order_id=order.order_id,
        razorpay_order_id=order.razorpay_order_id,
        previous_status=previous_status,
        new_status="Cancelled",
        reason=reason_text,
        execution_time_ms=exec_time_ms
    )

    return {
        "message": "Order marked as cancelled",
        "order_id": order.order_id,
        "payment_status": "Cancelled",
        "order_status": "Cancelled"
    }


@router.get("/orders", response_model=List[OrderOut])
async def get_user_orders(current_user: User = Depends(get_current_user)):
    orders = await Order.find(Order.user_id == str(current_user.id)).sort("-created_at").to_list()
    return [
        OrderOut(
            order_id=o.order_id,
            user_id=o.user_id,
            items=o.items,
            total_amount=o.total_amount,
            currency=o.currency,
            razorpay_order_id=o.razorpay_order_id,
            payment_status=o.payment_status,
            order_status=o.order_status,
            created_at=o.created_at
        ) for o in orders
    ]


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order_by_id(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    order = await Order.find_one(Order.order_id == order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to access this order")

    return OrderOut(
        order_id=order.order_id,
        user_id=order.user_id,
        items=order.items,
        total_amount=order.total_amount,
        currency=order.currency,
        razorpay_order_id=order.razorpay_order_id,
        payment_status=order.payment_status,
        order_status=order.order_status,
        created_at=order.created_at
    )
