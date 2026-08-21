"""
RevenuePilot AI — MongoDB Connection Layer
Uses Motor (async) with connection pooling and retry logic.
"""
from __future__ import annotations

import asyncio
from typing import Optional

import motor.motor_asyncio
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
_database: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None


async def connect_to_mongodb(max_retries: int = 5, delay: float = 2.0) -> None:
    """Establish async MongoDB connection with retry logic."""
    global _client, _database

    for attempt in range(1, max_retries + 1):
        try:
            logger.info("Connecting to MongoDB", attempt=attempt, url=settings.MONGODB_URL)
            _client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.MONGODB_URL,
                maxPoolSize=20,
                minPoolSize=5,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                socketTimeoutMS=30000,
            )
            # Force connection to verify
            await _client.admin.command("ping")
            _database = _client[settings.DATABASE_NAME]
            logger.info(
                "MongoDB connected",
                database=settings.DATABASE_NAME,
                attempt=attempt,
            )
            return
        except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
            logger.warning("MongoDB connection failed", attempt=attempt, error=str(exc))
            if attempt == max_retries:
                logger.error("MongoDB connection exhausted retries")
                raise
            await asyncio.sleep(delay * attempt)


async def close_mongodb_connection() -> None:
    """Gracefully close the MongoDB connection."""
    global _client, _database
    if _client:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed")


def get_database() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    """Return the active database instance."""
    if _database is None:
        raise RuntimeError("MongoDB is not connected. Call connect_to_mongodb() first.")
    return _database


def get_collection(name: str) -> motor.motor_asyncio.AsyncIOMotorCollection:
    """Return a named collection from the active database."""
    return get_database()[name]


async def health_check() -> bool:
    """Return True if MongoDB is reachable."""
    try:
        if _client is None:
            return False
        await _client.admin.command("ping")
        return True
    except Exception:
        return False
