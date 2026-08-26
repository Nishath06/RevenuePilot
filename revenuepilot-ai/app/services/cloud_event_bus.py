"""
RevenuePilot AI — Cloud Event Bus, AWS Lambda Simulation Layer & DLQ Handler
Extends local Event Bus with trace_id, merchant_id, execution_mode, Dead-Letter Queue (DLQ), and AWS Lambda abstractions.
"""
from typing import Any, Dict, List, Optional
import uuid
import time
import asyncio
from datetime import datetime, timezone
from app.db.mongodb import get_mongodb
from app.models.event_history import EventRecord
from app.services.aws_eventbridge import aws_manager
from app.core.logging import get_logger

logger = get_logger(__name__)


class CloudEventBus:
    def __init__(self):
        pass

    async def publish(
        self,
        event_type: str,
        payload: Dict[str, Any],
        source: str = "revenuepilot-store",
        merchant_id: str = "merch_default",
        severity: str = "info",
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        PART 8 — AWS EventBridge & Local Event Bus Workflow with Trace ID, DLQ, and Exponential Backoff Retries.
        Payload includes: merchant_id, trace_id, timestamp, execution_mode, event_type, severity.
        """
        db = get_mongodb()
        event_id = f"evt_{uuid.uuid4().hex[:12]}"
        trace = trace_id or f"trace_{uuid.uuid4().hex[:16]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        mode = "AWS EventBridge Mode" if aws_manager.has_credentials else "Local Event Bus Mode"

        event_doc = {
            "event_id": event_id,
            "event_type": event_type,
            "source": source,
            "merchant_id": merchant_id,
            "severity": severity,
            "timestamp": now_iso,
            "payload": payload,
            "trace_id": trace,
            "execution_mode": mode,
            "status": "processed",
        }

        # 1. Store in MongoDB `events` collection
        try:
            await db.events.insert_one(event_doc)
        except Exception as err:
            logger.error("Failed to insert event into MongoDB", error=str(err))

        # 2. Publish to AWS EventBridge with exponential backoff retries
        publish_success = False
        aws_res = {}
        for attempt in range(1, 4):
            try:
                aws_res = aws_manager.publish_eventbridge(
                    event_type=event_type,
                    detail={
                        "event_id": event_id,
                        "trace_id": trace,
                        "merchant_id": merchant_id,
                        "severity": severity,
                        **payload,
                    },
                    source=source,
                )
                publish_success = True
                break
            except Exception as err:
                logger.warning(f"EventBridge publish attempt {attempt} failed", error=str(err))
                await asyncio.sleep(0.1 * (2 ** (attempt - 1)))  # Exponential backoff

        # 3. If failed after retries, insert into Dead Letter Queue (DLQ)
        if not publish_success:
            dlq_doc = {
                "dlq_id": f"dlq_{uuid.uuid4().hex[:10]}",
                "event_id": event_id,
                "event_type": event_type,
                "reason": "EventBridge publish failure after 3 retries",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": payload,
            }
            await db.dlq_events.insert_one(dlq_doc)
            logger.error("Event added to Dead Letter Queue (DLQ)", dlq_id=dlq_doc["dlq_id"])

        # 4. Trigger Automation Engine
        try:
            from app.services.automation_engine import automation_engine
            evt_rec = EventRecord(
                event_id=event_id,
                event_type=event_type,
                source=source,
                timestamp=now_iso,
                payload=payload,
                severity=severity,
                status="processed",
            )
            await automation_engine.process_event(evt_rec)
        except Exception as err:
            logger.error("Automation Engine execution failed", error=str(err))

        if "_id" in event_doc:
            del event_doc["_id"]
        return event_doc

    async def invoke_lambda_function(
        self,
        function_name: str,
        payload: Dict[str, Any],
        merchant_id: str = "merch_default"
    ) -> Dict[str, Any]:
        """
        PART 9 — AWS Lambda Simulation Layer.
        Supports InventoryLambda, RecoveryLambda, ReportsLambda, IncidentLambda, CloudWatchLambda.
        Invokes boto3 if credentials exist, or executes local simulation with complete execution history saved in MongoDB.
        """
        db = get_mongodb()
        start_time = time.perf_counter()
        exec_id = f"lam_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # Check AWS credentials
        aws_res = aws_manager.invoke_lambda(function_name=function_name, payload=payload)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        exec_doc = {
            "execution_id": exec_id,
            "function_name": function_name,
            "merchant_id": merchant_id,
            "payload": payload,
            "status": "SUCCESS" if aws_res.get("status") in ["invoked", "success"] else "FALLBACK_SUCCESS",
            "duration_ms": elapsed_ms,
            "timestamp": now_iso,
            "execution_mode": "AWS Boto3 Lambda" if aws_manager.has_credentials else "Local Lambda Simulation Layer",
            "result": aws_res,
        }

        await db.lambda_executions.insert_one(exec_doc)
        if "_id" in exec_doc:
            del exec_doc["_id"]

        return exec_doc

    async def get_dlq_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetches Dead Letter Queue events.
        """
        db = get_mongodb()
        cursor = db.dlq_events.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def get_lambda_executions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Retrieves Lambda execution history logs.
        """
        db = get_mongodb()
        cursor = db.lambda_executions.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
        return await cursor.to_list(length=limit)


cloud_event_bus = CloudEventBus()
