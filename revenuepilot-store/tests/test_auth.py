import pytest
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.schemas.auth import UserRegister, UserLogin

def test_password_hashing():
    password = "SecretPassword123"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_jwt_token_generation():
    subject = "user_12345"
    token = create_access_token(user_id=subject, merchant_id="merch_test", role="merchant")
    assert isinstance(token, str)
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == subject
    assert payload.get("user_id") == subject
    assert payload.get("merchant_id") == "merch_test"
    assert payload.get("role") == "merchant"

def test_user_schemas():
    reg = UserRegister(
        name="Alex Dev",
        email="alex@revenuepilot.com",
        phone="9988776655",
        password="securepassword"
    )
    assert reg.name == "Alex Dev"
    assert reg.email == "alex@revenuepilot.com"
