from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id: str = payload.get("user_id") or payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    user = await User.get(user_id)
    if user is None:
        raise credentials_exception
    if payload.get("role") != user.role or payload.get("merchant_id") != user.merchant_id:
        raise credentials_exception
    return user

async def require_merchant(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {"merchant", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Merchant role required")
    return current_user
