from datetime import datetime, timezone
from typing import Literal, Optional
from beanie import Document, Indexed
from pydantic import Field

class User(Document):
    name: str
    email: Indexed(str, unique=True)
    phone: str
    password_hash: str
    role: Literal["customer", "merchant", "admin"] = "customer"
    merchant_id: Indexed(str) = "merch_default"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
