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

import asyncio

db_client: AsyncIOMotorClient = None

async def init_db(max_retries: int = 5, delay: float = 2.0):
    global db_client
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL} (Attempt {attempt}/{max_retries})...")
            db_client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
            )
            # Force ping to verify server connectivity
            await db_client.admin.command("ping")

            await init_beanie(
                database=db_client[settings.DATABASE_NAME],
                document_models=[
                    User,
                    Product,
                    Cart,
                    Order,
                    Payment,
                    WebhookEvent
                ],
                allow_index_dropping=True
            )
            logger.info("MongoDB and Beanie initialized successfully.")
            return
        except Exception as exc:
            logger.warning(f"MongoDB/Beanie connection attempt {attempt} failed: {exc}")
            if attempt == max_retries:
                logger.error("Exhausted retries for MongoDB initialization.")
                raise
            await asyncio.sleep(delay * attempt)

async def close_db():
    global db_client
    if db_client:
        db_client.close()
        logger.info("MongoDB connection closed.")
