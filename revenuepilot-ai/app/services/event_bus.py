"""
RevenuePilot AI — Event Bus Service
Receives, stores, and dispatches business events across RevenuePilot.
"""
from typing import Any, Dict, List, Optional
import uuid
from datetime import datetime
from app.db.mongodb import get_mongodb
from app.models.event_history import EventRecord
from app.services.aws_eventbridge import aws_manager
from app.core.logging import get_logger

logger = get_logger(__name__)


class EventBus:
    def __init__(self):
        pass

    async def emit(
        self,
        event_type: str,
        payload: Dict[str, Any],
        source: str = "revenuepilot-store",
        severity: str = "info",
    ) -> EventRecord:
        """
        Emits a business event into the AutoOps Event Bus queue.
        Saves to MongoDB and publishes to AWS EventBridge (with local fallback).
        """
        db = get_mongodb()
        event_id = f"evt_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.utcnow().isoformat()

        event_rec = EventRecord(
            event_id=event_id,
            event_type=event_type,
            source=source,
            timestamp=now_iso,
            payload=payload,
            severity=severity,
            status="processed",
        )

        # 1. Store event in MongoDB `events` collection
        try:
            await db.events.insert_one(event_rec.dict())
        except Exception as err:
            logger.error("Failed to insert event into MongoDB", error=str(err))

        # 2. Publish to AWS EventBridge (or local fallback)
        aws_res = aws_manager.publish_eventbridge(
            event_type=event_type,
            detail={"event_id": event_id, "severity": severity, **payload},
            source=source,
        )
        logger.info("Event emitted into EventBus", event_id=event_id, event_type=event_type, aws_status=aws_res.get("status"))

        # 3. Process event through Automation Engine rules
        try:
            from app.services.automation_engine import automation_engine
            await automation_engine.process_event(event_rec)
        except Exception as err:
            logger.error("Error evaluating event in Automation Engine", error=str(err))

        return event_rec

    async def get_recent_events(
        self,
        limit: int = 50,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Fetches recent events stored in MongoDB.
        """
        db = get_mongodb()
        query: Dict[str, Any] = {}
        if event_type:
            query["event_type"] = event_type
        if severity:
            query["severity"] = severity

        cursor = db.events.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
        events = await cursor.to_list(length=limit)
        return events


# Singleton instance
event_bus = EventBus()
