from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from app.models.cart import CartItem

class AddToCartRequest(BaseModel):
    product_id: str
    quantity: int = 1

class UpdateCartItemRequest(BaseModel):
    quantity: int

class CartOut(BaseModel):
    user_id: str
    items: List[CartItem]
    subtotal: float
    updated_at: datetime
