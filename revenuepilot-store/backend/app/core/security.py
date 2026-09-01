from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
import bcrypt
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    # Truncate to 72 bytes if needed per bcrypt spec
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(
    user_id: Optional[str] = None,
    subject: Optional[str] = None,
    merchant_id: str = "merch_default",
    role: str = "merchant",
    expires_delta: Optional[timedelta] = None
) -> str:
    uid = user_id or subject or "user_default"
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    issued_at = datetime.now(timezone.utc)
    to_encode = {"exp": expire, "sub": str(uid), "user_id": str(uid), "merchant_id": merchant_id, "role": role, "iat": issued_at}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
