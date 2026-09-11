import pytest
from app.models.cart import CartItem
from app.routers.cart import calculate_subtotal

def test_cart_subtotal_calculation():
    items = [
        CartItem(product_id="prod_1", title="Headphones", price=14999.00, quantity=1),
        CartItem(product_id="prod_2", title="Keyboard", price=8499.00, quantity=2)
    ]
    subtotal = calculate_subtotal(items)
    # 14999 + (8499 * 2) = 14999 + 16998 = 31997.0
    assert subtotal == 31997.0
