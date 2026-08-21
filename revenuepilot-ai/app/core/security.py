"""
RevenuePilot AI — Security Layer
Optional API key verification for merchant dashboard calls.
"""
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(_api_key_header)) -> str:
    """
    Verify the API key sent in the X-API-Key header.
    If API_SECRET_KEY is empty, auth is disabled (dev mode).
    """
    if not settings.API_SECRET_KEY:
        return "dev"
    if api_key != settings.API_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return api_key
