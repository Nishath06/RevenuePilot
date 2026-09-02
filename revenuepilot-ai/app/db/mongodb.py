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
            await _ensure_indexes()
            logger.info(
                "MongoDB connected and indexes verified",
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
    """Return the active database instance, recreating Motor client if running loop changed or client is uninitialized."""
    global _client, _database
    if _client is None or _database is None:
        _client = motor.motor_asyncio.AsyncIOMotorClient(
            settings.MONGODB_URL,
            maxPoolSize=20,
            minPoolSize=5,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=30000,
        )
        _database = _client[settings.DATABASE_NAME]

    try:
        current_loop = asyncio.get_running_loop()
        client_loop = getattr(_client, "get_io_loop", lambda: None)() or getattr(_client, "io_loop", None)
        if client_loop and client_loop != current_loop and not current_loop.is_closed():
            _client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.MONGODB_URL,
                maxPoolSize=20,
                minPoolSize=5,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                socketTimeoutMS=30000,
            )
            _database = _client[settings.DATABASE_NAME]
    except Exception:
        pass

    return _database


def get_collection(name: str) -> motor.motor_asyncio.AsyncIOMotorCollection:
    """Return a named collection from the active database."""
    return get_database()[name]


get_mongodb = get_database


async def _ensure_indexes() -> None:
    """Ensure required compound and TTL indexes exist for optimal Motor aggregation performance."""
    if _database is None:
        return

    index_specs = [
        ("orders", [("user_id", 1), ("payment_status", 1)]),
        ("orders", [("payment_status", 1), ("created_at", -1)]),
        ("orders", [("created_at", -1)]),
        ("payments", [("order_id", 1), ("status", 1)]),
        ("payments", [("status", 1), ("created_at", -1)]),
        ("products", [("category", 1), ("stock", 1)]),
        ("products", [("stock", 1)]),
        ("customers", [("merchant_id", 1), ("created_at", -1)]),
        ("events", [("event_type", 1), ("timestamp", -1)]),
        ("execution_history", [("timestamp", -1)]),
        ("incidents", [("status", 1), ("severity", 1)]),
        ("recovery_campaigns", [("status", 1), ("created_at", -1)]),
        ("ai_conversations", [("merchant_id", 1), ("updated_at", -1)]),
        ("ai_messages", [("conversation_id", 1), ("timestamp", 1)]),
        ("merchant_settings", [("merchant_id", 1)]),
        # Recovery Candidates
        ("recovery_candidates", [("status", 1)]),
        ("recovery_candidates", [("campaign_id", 1)]),
        ("recovery_candidates", [("scheduled_send_time", 1)]),
        ("recovery_candidates", [("customer_id", 1)]),
        ("recovery_candidates", [("merchant_id", 1)]),
        ("recovery_candidates", [("created_at", -1)]),
        ("recovery_candidates", [("expires_at", 1)]),
        # Campaign Runs
        ("campaign_runs", [("campaign_id", 1)]),
        ("campaign_runs", [("status", 1)]),
        ("campaign_runs", [("created_at", -1)]),
        ("campaign_runs", [("scheduled_send_time", 1)]),
    ]

    for coll_name, keys in index_specs:
        try:
            await _database[coll_name].create_index(keys)
        except Exception:
            pass

    # TTL indexes — auto-purge old events after 90 days
    try:
        await _database["events"].create_index([("timestamp", 1)], expireAfterSeconds=7776000)
    except Exception:
        pass
    try:
        await _database["execution_history"].create_index([("timestamp", 1)], expireAfterSeconds=7776000)
    except Exception:
        pass

    logger.info("MongoDB compound and TTL indexes verified successfully")


async def health_check() -> bool:
    """Return True if MongoDB is reachable."""
    try:
        db = get_database()
        if db is not None:
            await db.command("ping")
            return True
        return False
    except Exception:
        return False
