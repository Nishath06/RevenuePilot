from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class ProductOut(BaseModel):
    product_id: str
    title: str
    description: str
    category: str
    brand: str
    images: List[str]
    price: float
    stock: int
    tags: List[str]
    created_at: datetime

class ProductListResponse(BaseModel):
    products: List[ProductOut]
    total: int
