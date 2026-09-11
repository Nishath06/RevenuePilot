import pytest
from app.schemas.checkout import OrderOut, CreateOrderRequest
from app.models.order import OrderItem

def test_order_out_schema():
    items = [
        OrderItem(
            product_id="prod_wh1000",
            title="AeroSound Pro Wireless Headphones",
            price=14999.0,
            quantity=1
        )
    ]
    order_out = OrderOut(
        order_id="ord_123456",
        user_id="user_789",
        items=items,
        total_amount=14999.0,
        currency="INR",
        razorpay_order_id="order_rzp_999",
        payment_status="Pending",
        order_status="Pending",
        created_at="2026-08-20T22:00:00Z"
    )
    assert order_out.order_id == "ord_123456"
    assert order_out.payment_status in ["Pending", "Paid", "Failed", "Cancelled"]
    assert order_out.order_status in ["Pending", "Paid", "Failed", "Cancelled"]
