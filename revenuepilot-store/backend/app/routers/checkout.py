import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.models.user import User
from app.models.cart import Cart
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.schemas.checkout import CreateOrderRequest, VerifyPaymentRequest, OrderOut, RazorpayOrderResponse
from app.services.razorpay import razorpay_service
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="", tags=["Checkout & Orders"])

@router.post("/checkout/create-order", response_model=RazorpayOrderResponse)
async def create_order(
    req: CreateOrderRequest,
    current_user: User = Depends(get_current_user)
):
    items_to_order = []

    if req.items and len(req.items) > 0:
        items_to_order = req.items
    else:
        cart = await Cart.find_one(Cart.user_id == str(current_user.id))
        if not cart or not cart.items:
            raise HTTPException(status_code=400, detail="Cart is empty")

        items_to_order = [
            OrderItem(
                product_id=item.product_id,
                title=item.title,
                price=item.price,
                image=item.image,
                quantity=item.quantity
            )
            for item in cart.items
        ]

    # Original order amount (keep for DB)
    original_total = round(
        sum(item.price * item.quantity for item in items_to_order), 2
    )

    # -----------------------------
    # TEST MODE ONLY (Day 1)
    # Change back to original_total after testing.
    # -----------------------------
    razorpay_amount = 100.00  # ₹100 test payment

    order_id = f"ord_{uuid.uuid4().hex[:12]}"

    rzp_order = razorpay_service.create_order(
        amount=razorpay_amount,
        currency="INR",
        receipt=order_id,
        notes={
            "order_id": order_id,
            "user_id": str(current_user.id)
        }
    )

    db_order = Order(
        order_id=order_id,
        user_id=str(current_user.id),
        items=items_to_order,
        total_amount=original_total,
        currency="INR",
        razorpay_order_id=rzp_order["id"],
        payment_status="Pending",
        order_status="Pending",
        created_at=datetime.now(timezone.utc)
    )
    await db_order.insert()

    return RazorpayOrderResponse(
        order_id=db_order.order_id,
        razorpay_order_id=rzp_order["id"],
        amount=rzp_order["amount"],  # 10000 paise
        currency=rzp_order["currency"],
        key=settings.RAZORPAY_KEY_ID
    )

@router.post("/checkout/verify-payment")
async def verify_payment(
    req: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user)
):
    order = await Order.find_one(Order.razorpay_order_id == req.razorpay_order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    is_valid = razorpay_service.verify_signature(
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        razorpay_signature=req.razorpay_signature
    )
    
    if not is_valid:
        order.payment_status = "Failed"
        order.order_status = "Failed"
        await order.save()
        
        payment = Payment(
            payment_id=f"pay_{uuid.uuid4().hex[:12]}",
            order_id=order.order_id,
            razorpay_payment_id=req.razorpay_payment_id,
            amount=order.total_amount,
            method="card",
            status="failed",
            failure_reason="Invalid signature",
            created_at=datetime.now(timezone.utc)
        )
        await payment.insert()
        raise HTTPException(status_code=400, detail="Invalid payment signature")
        
    order.payment_status = "Paid"
    order.order_status = "Paid"
    await order.save()
    
    # Record payment
    payment = Payment(
        payment_id=f"pay_{uuid.uuid4().hex[:12]}",
        order_id=order.order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        amount=order.total_amount,
        method="card",
        status="captured",
        created_at=datetime.now(timezone.utc)
    )
    await payment.insert()
    
    # Clear user's cart after successful purchase
    cart = await Cart.find_one(Cart.user_id == str(current_user.id))
    if cart:
        cart.items = []
        cart.subtotal = 0.0
        await cart.save()
        
    return {
        "message": "Payment verified successfully",
        "order_id": order.order_id,
        "payment_status": "Paid"
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
