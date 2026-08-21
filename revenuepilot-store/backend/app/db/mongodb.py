from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.core.logging import logger
from app.models.user import User
from app.models.product import Product
from app.models.cart import Cart
from app.models.order import Order
from app.models.payment import Payment
from app.models.webhook import WebhookEvent

db_client: AsyncIOMotorClient = None

async def init_db():
    global db_client
    logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    db_client = AsyncIOMotorClient(settings.MONGODB_URL)
    
    await init_beanie(
        database=db_client[settings.DATABASE_NAME],
        document_models=[
            User,
            Product,
            Cart,
            Order,
            Payment,
            WebhookEvent
        ]
    )
    logger.info("MongoDB and Beanie initialized successfully.")

async def close_db():
    global db_client
    if db_client:
        db_client.close()
        logger.info("MongoDB connection closed.")
