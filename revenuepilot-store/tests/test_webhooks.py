import os
import pytest
import hmac
import hashlib
from app.services.razorpay import razorpay_service
from app.core.config import settings

def _has_razorpay_keys() -> bool:
    key_id = os.environ.get("RAZORPAY_KEY_ID", "").strip()
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()
    return bool(key_id and secret and not key_id.startswith("rzp_test_placeholder") and not secret.startswith("placeholder"))

pytestmark = [
    pytest.mark.integration,
    pytest.mark.razorpay,
    pytest.mark.skipif(
        not _has_razorpay_keys(),
        reason="Requires valid Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET)"
    )
]


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
