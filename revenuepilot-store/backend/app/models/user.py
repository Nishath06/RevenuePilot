from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field

class User(Document):
    name: str
    email: Indexed(str, unique=True)
    phone: str
    password_hash: str
    role: Optional[str] = "merchant"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
