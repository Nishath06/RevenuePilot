"""Shared Store JWT authentication and merchant authorization for the AI API."""
from dataclasses import dataclass
import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)

@dataclass(frozen=True)
class Principal:
    user_id: str
    merchant_id: str
    role: str

async def verify_api_key(credentials: HTTPAuthorizationCredentials | None = Security(_bearer)) -> Principal:
    """Compatibility name retained while enforcing a signed Store JWT."""
    if credentials is None or credentials.scheme.lower() != "bearer" or not settings.JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        principal = Principal(str(claims["user_id"]), str(claims["merchant_id"]), str(claims["role"]))
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token") from exc
    if principal.role not in {"merchant", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Merchant role required")
    return principal
