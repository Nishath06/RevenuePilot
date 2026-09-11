import pytest
from app.services.seed import SAMPLE_PRODUCTS
from app.schemas.product import ProductOut

def test_sample_products_integrity():
    assert len(SAMPLE_PRODUCTS) == 10
    for p in SAMPLE_PRODUCTS:
        assert "product_id" in p
        assert "title" in p
        assert "price" in p
        assert p["price"] > 0
        assert "category" in p

def test_product_out_schema():
    p_data = SAMPLE_PRODUCTS[0]
    p_out = ProductOut(
        product_id=p_data["product_id"],
        title=p_data["title"],
        description=p_data["description"],
        category=p_data["category"],
        brand=p_data["brand"],
        images=p_data["images"],
        price=p_data["price"],
        stock=p_data["stock"],
        tags=p_data["tags"],
        created_at="2026-08-20T22:00:00Z"
    )
    assert p_out.product_id == "prod_wh1000"
    assert p_out.price == 14999.00
