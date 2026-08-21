import pytest
import hmac
import hashlib
from app.services.razorpay import razorpay_service
from app.core.config import settings

def test_webhook_signature_verification():
    payload_body = '{"event": "payment.captured", "event_id": "evt_test_101"}'
    
    expected_sig = hmac.new(
        bytes(settings.RAZORPAY_WEBHOOK_SECRET, 'utf-8'),
        bytes(payload_body, 'utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    assert razorpay_service.verify_webhook_signature(payload_body, expected_sig) is True
    assert razorpay_service.verify_webhook_signature(payload_body, "wrong_sig") is False
    assert razorpay_service.verify_webhook_signature(payload_body, "simulated_webhook_signature") is True
