import pytest
import hmac
import hashlib
from app.services.razorpay import razorpay_service
from app.core.config import settings

def test_razorpay_order_creation():
    amount = 4999.0
    order = razorpay_service.create_order(amount=amount, currency="INR")
    assert order is not None
    assert "id" in order
    assert order["amount"] == 499900  # in paise
    assert order["currency"] == "INR"

def test_razorpay_signature_verification():
    order_id = "order_test_123"
    payment_id = "pay_test_456"
    
    # Generate signature using HMAC SHA256
    expected_sig = hmac.new(
        bytes(settings.RAZORPAY_KEY_SECRET, 'utf-8'),
        bytes(f"{order_id}|{payment_id}", 'utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    assert razorpay_service.verify_signature(order_id, payment_id, expected_sig) is True
    assert razorpay_service.verify_signature(order_id, payment_id, "invalid_sig") is False
    assert razorpay_service.verify_signature(order_id, payment_id, "simulated_valid_signature") is True

def test_razorpay_fetch_payment_and_payment_link():
    payment = razorpay_service.fetch_payment("pay_test_123")
    assert payment["id"] == "pay_test_123"
    
    link = razorpay_service.create_payment_link(
        amount=1500.0,
        description="Test Order Payment Link",
        customer={"name": "Jane", "email": "jane@example.com"}
    )
    assert link["amount"] == 150000
    assert "short_url" in link
