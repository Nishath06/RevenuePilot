"""
RevenuePilot AI — Demo Database Reset Script
Clears all demo collections in MongoDB Atlas to prepare for clean data seeding.
"""
import asyncio
import sys
import os

# Ensure root workspace directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

COLLECTIONS_TO_RESET = [
    "orders",
    "payments",
    "customers",
    "products",
    "inventory_events",
    "recovery_campaigns",
    "ai_conversations",
    "conversations",
    "reports",
    "generated_reports",
    "events",
    "lambda_executions",
    "cloudwatch_metrics",
    "execution_history",
    "incidents",
    "watchdog_snapshots",
    "watchdogs",
    "aws_audit_logs",
    "dlq_events",
    "recommendations",
    "customer_preferences",
    "automation_schedules",
]


async def reset_demo_database() -> dict:
    """
    Clears all demo collections in MongoDB.
    """
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    deletion_summary = {}
    logger.info("Starting demo database reset...", database=settings.DATABASE_NAME)

    for col_name in COLLECTIONS_TO_RESET:
        try:
            res = await db[col_name].delete_many({})
            deletion_summary[col_name] = res.deleted_count
            logger.info(f"Cleared collection: {col_name}", deleted_count=res.deleted_count)
        except Exception as err:
            logger.error(f"Failed to clear collection {col_name}", error=str(err))
            deletion_summary[col_name] = 0

    client.close()
    return deletion_summary


if __name__ == "__main__":
    summary = asyncio.run(reset_demo_database())
    print("\n===========================================")
    print(" REVENUEPILOT DEMO DATABASE RESET COMPLETE")
    print("===========================================")
    for col, count in summary.items():
        print(f" - {col:<25}: {count} records deleted")
    print("===========================================\n")
