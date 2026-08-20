from datetime import datetime, timezone
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import Field

class Product(Document):
    product_id: Indexed(str, unique=True)
    title: str
    description: str
    category: Indexed(str)
    brand: str
    images: List[str] = []
    price: float
    stock: int
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "products"
