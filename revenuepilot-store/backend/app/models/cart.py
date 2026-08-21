from datetime import datetime, timezone
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field

class CartItem(BaseModel):
    product_id: str
    title: str
    price: float
    image: Optional[str] = ""
    quantity: int = 1

class Cart(Document):
    user_id: Indexed(str, unique=True)
    items: List[CartItem] = []
    subtotal: float = 0.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "carts"
