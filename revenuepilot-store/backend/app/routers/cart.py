from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.models.user import User
from app.models.product import Product
from app.models.cart import Cart, CartItem
from app.schemas.cart import AddToCartRequest, UpdateCartItemRequest, CartOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])

async def get_or_create_cart(user_id: str) -> Cart:
    cart = await Cart.find_one(Cart.user_id == user_id)
    if not cart:
        cart = Cart(user_id=user_id, items=[], subtotal=0.0)
        await cart.insert()
    return cart

def calculate_subtotal(items) -> float:
    return round(sum(item.price * item.quantity for item in items), 2)

@router.get("", response_model=CartOut)
async def get_cart(current_user: User = Depends(get_current_user)):
    cart = await get_or_create_cart(str(current_user.id))
    return CartOut(
        user_id=cart.user_id,
        items=cart.items,
        subtotal=cart.subtotal,
        updated_at=cart.updated_at
    )

@router.post("/items", response_model=CartOut)
async def add_item_to_cart(
    req: AddToCartRequest,
    current_user: User = Depends(get_current_user)
):
    product = await Product.find_one(Product.product_id == req.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    cart = await get_or_create_cart(str(current_user.id))
    
    # Check if item already exists in cart
    existing_item = next((item for item in cart.items if item.product_id == req.product_id), None)
    if existing_item:
        existing_item.quantity += req.quantity
    else:
        new_item = CartItem(
            product_id=product.product_id,
            title=product.title,
            price=product.price,
            image=product.images[0] if product.images else "",
            quantity=req.quantity
        )
        cart.items.append(new_item)
        
    cart.subtotal = calculate_subtotal(cart.items)
    cart.updated_at = datetime.now(timezone.utc)
    await cart.save()
    
    return CartOut(
        user_id=cart.user_id,
        items=cart.items,
        subtotal=cart.subtotal,
        updated_at=cart.updated_at
    )

@router.patch("/items/{product_id}", response_model=CartOut)
async def update_cart_item(
    product_id: str,
    req: UpdateCartItemRequest,
    current_user: User = Depends(get_current_user)
):
    cart = await get_or_create_cart(str(current_user.id))
    
    existing_item = next((item for item in cart.items if item.product_id == product_id), None)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item not in cart")
        
    if req.quantity <= 0:
        cart.items = [item for item in cart.items if item.product_id != product_id]
    else:
        existing_item.quantity = req.quantity
        
    cart.subtotal = calculate_subtotal(cart.items)
    cart.updated_at = datetime.now(timezone.utc)
    await cart.save()
    
    return CartOut(
        user_id=cart.user_id,
        items=cart.items,
        subtotal=cart.subtotal,
        updated_at=cart.updated_at
    )

@router.delete("/items/{product_id}", response_model=CartOut)
async def delete_cart_item(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    cart = await get_or_create_cart(str(current_user.id))
    cart.items = [item for item in cart.items if item.product_id != product_id]
    cart.subtotal = calculate_subtotal(cart.items)
    cart.updated_at = datetime.now(timezone.utc)
    await cart.save()
    
    return CartOut(
        user_id=cart.user_id,
        items=cart.items,
        subtotal=cart.subtotal,
        updated_at=cart.updated_at
    )

@router.delete("", response_model=CartOut)
async def clear_cart(current_user: User = Depends(get_current_user)):
    cart = await get_or_create_cart(str(current_user.id))
    cart.items = []
    cart.subtotal = 0.0
    cart.updated_at = datetime.now(timezone.utc)
    await cart.save()
    
    return CartOut(
        user_id=cart.user_id,
        items=cart.items,
        subtotal=cart.subtotal,
        updated_at=cart.updated_at
    )
