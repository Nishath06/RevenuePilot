from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.product import Product
from app.schemas.product import ProductOut, ProductListResponse

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("", response_model=ProductListResponse)
async def get_products(
    category: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    query = {}
    if category and category.lower() != "all":
        query["category"] = category
        
    products = await Product.find(query).skip(skip).limit(limit).to_list()
    total = await Product.find(query).count()
    
    return ProductListResponse(
        products=[
            ProductOut(
                product_id=p.product_id,
                title=p.title,
                description=p.description,
                category=p.category,
                brand=p.brand,
                images=p.images,
                price=p.price,
                stock=p.stock,
                tags=p.tags,
                created_at=p.created_at
            ) for p in products
        ],
        total=total
    )

@router.get("/categories", response_model=List[str])
async def get_categories():
    products = await Product.find_all().to_list()
    categories = sorted(list(set(p.category for p in products)))
    return categories

@router.get("/search", response_model=ProductListResponse)
async def search_products(q: str = Query(..., min_length=1)):
    regex_pattern = f".*{q}.*"
    products = await Product.find({
        "$or": [
            {"title": {"$regex": regex_pattern, "$options": "i"}},
            {"description": {"$regex": regex_pattern, "$options": "i"}},
            {"category": {"$regex": regex_pattern, "$options": "i"}},
            {"tags": {"$regex": regex_pattern, "$options": "i"}}
        ]
    }).to_list()
    
    return ProductListResponse(
        products=[
            ProductOut(
                product_id=p.product_id,
                title=p.title,
                description=p.description,
                category=p.category,
                brand=p.brand,
                images=p.images,
                price=p.price,
                stock=p.stock,
                tags=p.tags,
                created_at=p.created_at
            ) for p in products
        ],
        total=len(products)
    )

@router.get("/{product_id}", response_model=ProductOut)
async def get_product_by_id(product_id: str):
    product = await Product.find_one(Product.product_id == product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return ProductOut(
        product_id=product.product_id,
        title=product.title,
        description=product.description,
        category=product.category,
        brand=product.brand,
        images=product.images,
        price=product.price,
        stock=product.stock,
        tags=product.tags,
        created_at=product.created_at
    )
