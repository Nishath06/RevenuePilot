from datetime import datetime, timezone
from app.models.product import Product
from app.core.logging import logger

SAMPLE_PRODUCTS = [
    {
        "product_id": "prod_wh1000",
        "title": "AeroSound Pro Wireless Headphones",
        "description": "Premium active noise-canceling over-ear wireless headphones with 40-hour battery life and spatial audio.",
        "category": "Audio",
        "brand": "AeroSound",
        "images": ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"],
        "price": 14999.00,
        "stock": 45,
        "tags": ["audio", "wireless", "noise-canceling", "headphones"]
    },
    {
        "product_id": "prod_mk800",
        "title": "TactilePro RGB Mechanical Keyboard",
        "description": "Customizable hot-swappable mechanical gaming keyboard with per-key RGB backlight and aluminum chassis.",
        "category": "Peripherals",
        "brand": "TactileTech",
        "images": ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80"],
        "price": 8499.00,
        "stock": 30,
        "tags": ["keyboard", "gaming", "rgb", "mechanical"]
    },
    {
        "product_id": "prod_ls300",
        "title": "ErgoLift Aluminum Laptop Stand",
        "description": "Ergonomic adjustable laptop riser built with premium anodized aluminum for improved posture and airflow.",
        "category": "Accessories",
        "brand": "ErgoLift",
        "images": ["https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80"],
        "price": 2999.00,
        "stock": 75,
        "tags": ["accessories", "laptop", "ergonomic", "stand"]
    },
    {
        "product_id": "prod_sw900",
        "title": "PulseFit Ultra Smart Watch",
        "description": "Advanced smartwatch featuring AMOLED display, ECG monitoring, built-in GPS, and 7-day battery life.",
        "category": "Wearables",
        "brand": "PulseFit",
        "images": ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80"],
        "price": 18999.00,
        "stock": 20,
        "tags": ["wearables", "smartwatch", "fitness", "gps"]
    },
    {
        "product_id": "prod_bs500",
        "title": "WaveBoom Waterproof Bluetooth Speaker",
        "description": "Rugged IPX7 waterproof portable speaker with 360-degree deep bass and 24 hours playback.",
        "category": "Audio",
        "brand": "WaveSound",
        "images": ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80"],
        "price": 4999.00,
        "stock": 60,
        "tags": ["audio", "speaker", "bluetooth", "waterproof"]
    },
    {
        "product_id": "prod_wc4k",
        "title": "VisionPro 4K Ultra HD Webcam",
        "description": "Professional 4K streaming webcam with auto-framing, dual noise-canceling mics, and privacy shutter.",
        "category": "Peripherals",
        "brand": "VisionPro",
        "images": ["https://images.unsplash.com/photo-1588702547923-7093a6c36452?w=800&auto=format&fit=crop&q=80"],
        "price": 9999.00,
        "stock": 35,
        "tags": ["webcam", "video", "streaming", "4k"]
    },
    {
        "product_id": "prod_gm600",
        "title": "SwiftGlide Ultra Light Gaming Mouse",
        "description": "59g ultra-lightweight wireless gaming mouse with 26K DPI optical sensor and 80-hour battery life.",
        "category": "Peripherals",
        "brand": "SwiftGlide",
        "images": ["https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80"],
        "price": 5499.00,
        "stock": 50,
        "tags": ["mouse", "gaming", "wireless", "lightweight"]
    },
    {
        "product_id": "prod_ssd2tb",
        "title": "VelocityPro 2TB NVMe M.2 SSD",
        "description": "High-performance PCIe Gen4 NVMe internal solid-state drive delivering read speeds up to 7400 MB/s.",
        "category": "Storage",
        "brand": "Velocity",
        "images": ["https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&auto=format&fit=crop&q=80"],
        "price": 12999.00,
        "stock": 40,
        "tags": ["storage", "ssd", "nvme", "pcie4"]
    },
    {
        "product_id": "prod_mon27",
        "title": "ApexVision 27-inch 4K IPS Monitor",
        "description": "27-inch 4K UHD IPS professional monitor featuring 99% DCI-P3 color accuracy, HDR400, and USB-C 65W PD.",
        "category": "Displays",
        "brand": "ApexVision",
        "images": ["https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80"],
        "price": 27999.00,
        "stock": 15,
        "tags": ["display", "monitor", "4k", "ips"]
    },
    {
        "product_id": "prod_hub9in1",
        "title": "LinkMax 9-in-1 USB-C Hub Station",
        "description": "Compact aluminum USB-C multiport adapter featuring 4K HDMI, Gigabit Ethernet, 100W PD charging, and SD reader.",
        "category": "Accessories",
        "brand": "LinkMax",
        "images": ["https://images.unsplash.com/photo-1544652478-6653e09f18a2?w=800&auto=format&fit=crop&q=80"],
        "price": 3499.00,
        "stock": 85,
        "tags": ["accessories", "usbc", "hub", "adapter"]
    }
]

from app.models.user import User
from app.core.security import get_password_hash, verify_password

async def seed_users_if_empty():
    default_users = [
        {
            "name": "RevenuePilot Merchant",
            "email": "merchant@revenuepilot.com",
            "phone": "+919876543210",
        },
        {
            "name": "Nishath (Admin)",
            "email": "jpnishath@gmail.com",
            "phone": "+919876543210",
        },
    ]

    for default_user in default_users:
        user = await User.find_one(User.email == default_user["email"])
        if not user:
            logger.info(f"Seeding default merchant user: {default_user['email']}")
            new_user = User(
                name=default_user["name"],
                email=default_user["email"],
                phone=default_user["phone"],
                password_hash=get_password_hash("password123"),
                created_at=datetime.now(timezone.utc)
            )
            await new_user.insert()
        else:
            # Verify existing hash is valid, update if corrupted
            if not verify_password("password123", user.password_hash):
                logger.info(f"Updating corrupted password hash for user: {default_user['email']}")
                user.password_hash = get_password_hash("password123")
                await user.save()

async def seed_products_if_empty():
    count = await Product.count()
    if count == 0:
        logger.info("No products found in DB. Seeding 10 realistic electronics products...")
        for p in SAMPLE_PRODUCTS:
            product = Product(
                product_id=p["product_id"],
                title=p["title"],
                description=p["description"],
                category=p["category"],
                brand=p["brand"],
                images=p["images"],
                price=p["price"],
                stock=p["stock"],
                tags=p["tags"],
                created_at=datetime.now(timezone.utc)
            )
            await product.insert()
        logger.info("Database successfully seeded with 10 electronics products.")
    else:
        logger.info(f"Database already contains {count} products. Skipping seeding.")
