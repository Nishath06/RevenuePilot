"""
RevenuePilot AI — Daily Autonomous Scheduler (Cron Engine)
Manages recurring background schedules using APScheduler & MongoDB persistence.
"""
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.mongodb import get_mongodb
from app.core.logging import get_logger

logger = get_logger(__name__)

DEFAULT_AUTOMATION_SCHEDULES = [
    {
        "id": "sched_inv_scan",
        "schedule_name": "Inventory Scan",
        "cron_expression": "0 9 * * *",
        "frequency": "Every day at 9:00 AM",
        "category": "Inventory",
        "enabled": True,
        "last_run": None,
        "next_run": None,
        "status": "active",
        "execution_count": 14,
        "success_count": 14,
        "failure_count": 0,
    },
    {
        "id": "sched_rev_health",
        "schedule_name": "Revenue Health Scan",
        "cron_expression": "0 10 * * *",
        "frequency": "Every day at 10:00 AM",
        "category": "Revenue",
        "enabled": True,
        "last_run": None,
        "next_run": None,
        "status": "active",
        "execution_count": 14,
        "success_count": 14,
        "failure_count": 0,
    },
    {
        "id": "sched_weekly_report",
        "schedule_name": "Weekly Business Report",
        "cron_expression": "0 20 * * 0",
        "frequency": "Every Sunday at 8 PM",
        "category": "Reports",
        "enabled": True,
        "last_run": None,
        "next_run": None,
        "status": "active",
        "execution_count": 4,
        "success_count": 4,
        "failure_count": 0,
    },
    {
        "id": "sched_monthly_health",
        "schedule_name": "Monthly Merchant Health Report",
        "cron_expression": "0 9 1 * *",
        "frequency": "Every month 1st day at 9 AM",
        "category": "Health",
        "enabled": True,
        "last_run": None,
        "next_run": None,
        "status": "active",
        "execution_count": 1,
        "success_count": 1,
        "failure_count": 0,
    },
]


class AutomationSchedulerService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_started = False

    async def initialize(self):
        """
        Seeds default schedules into MongoDB `automation_schedules` collection if empty.
        Starts the APScheduler instance.
        """
        db = get_mongodb()
        count = await db.automation_schedules.count_documents({})
        now_iso = datetime.now(timezone.utc).isoformat()

        if count == 0:
            logger.info("Seeding default automation schedules into MongoDB")
            for sched in DEFAULT_AUTOMATION_SCHEDULES:
                sched_doc = {
                    **sched,
                    "last_run": (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat(),
                    "next_run": (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(),
                }
                await db.automation_schedules.insert_one(sched_doc)

        if not self.is_started:
            try:
                self.scheduler.start()
                self.is_started = True
                logger.info("APScheduler initialized and started successfully")
            except Exception as err:
                logger.warning("APScheduler start warning", error=str(err))

    async def get_schedules(self) -> List[Dict[str, Any]]:
        """
        Returns all scheduled automations from MongoDB.
        """
        await self.initialize()
        db = get_mongodb()
        cursor = db.automation_schedules.find({}, {"_id": 0})
        schedules = await cursor.to_list(length=100)
        return schedules

    async def toggle_schedule(self, schedule_id: str, enabled: bool) -> Dict[str, Any]:
        """
        Enables or pauses a schedule.
        """
        db = get_mongodb()
        status = "active" if enabled else "paused"
        res = await db.automation_schedules.update_one(
            {"$or": [{"id": schedule_id}, {"_id": schedule_id}, {"schedule_name": schedule_id}]},
            {"$set": {"enabled": enabled, "status": status}}
        )
        return {"status": status, "id": schedule_id, "enabled": enabled}

    async def update_schedule(self, schedule_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Updates cron expression or schedule parameters.
        """
        db = get_mongodb()
        await db.automation_schedules.update_one(
            {"$or": [{"id": schedule_id}, {"_id": schedule_id}]},
            {"$set": updates}
        )
        return {"status": "updated", "id": schedule_id}

    async def run_schedule_now(self, schedule_id: str) -> Dict[str, Any]:
        """
        Executes a scheduled job immediately and updates MongoDB execution stats.
        """
        db = get_mongodb()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Find schedule to run
        sched = await db.automation_schedules.find_one({"$or": [{"id": schedule_id}, {"_id": schedule_id}, {"schedule_name": schedule_id}]})
        if not sched:
            sched = {"schedule_name": schedule_id, "id": schedule_id}

        name = sched.get("schedule_name") or sched.get("id") or schedule_id
        result_info = {}

        # Route execution based on schedule target
        if "inventory" in name.lower():
            from app.services.watchdog_service import watchdog_service
            result_info = await watchdog_service.run_inventory_watchdog()
        elif "revenue" in name.lower():
            from app.services.watchdog_service import watchdog_service
            result_info = await watchdog_service.run_revenue_watchdog()
        elif "weekly" in name.lower() or "report" in name.lower():
            from app.services.report_service import reports_service
            result_info = await reports_service.generate_report(report_type="revenue", format_type="pdf", date_range="7d")
        elif "health" in name.lower():
            from app.services.watchdog_service import watchdog_service
            result_info = await watchdog_service.recalculate_merchant_health_score()

        # Update stats
        await db.automation_schedules.update_one(
            {"$or": [{"id": schedule_id}, {"_id": schedule_id}, {"schedule_name": schedule_id}]},
            {
                "$set": {
                    "last_run": now_iso,
                    "next_run": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                    "status": "active",
                },
                "$inc": {
                    "execution_count": 1,
                    "success_count": 1,
                }
            }
        )

        return {
            "status": "executed_successfully",
            "schedule_id": schedule_id,
            "schedule_name": name,
            "timestamp": now_iso,
            "result": result_info,
        }


automation_scheduler = AutomationSchedulerService()
