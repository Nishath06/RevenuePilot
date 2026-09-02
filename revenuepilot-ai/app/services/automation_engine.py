"""
RevenuePilot AI — Automation Engine
Evaluates rules, conditions, and executes autonomous operations.
Pushes metrics to AWS CloudWatch, publishes events to EventBridge, sends SNS alerts, invokes Lambda, and uploads reports to S3.
"""
from typing import Any, Dict, List, Optional
import uuid
import time
from datetime import datetime

from app.db.mongodb import get_mongodb
from app.models.automation_rule import AutomationRule, RuleAction, RuleCondition
from app.models.event_history import EventRecord, ExecutionLog
from app.services.aws_eventbridge import aws_manager, publish_event
from app.services.aws_sns import send_notification
from app.services.aws_s3 import upload_report
from app.services.aws_cloudwatch import put_metric, put_log_event
from app.core.logging import get_logger

logger = get_logger(__name__)

# Prebuilt Workflow Templates
DEFAULT_PREBUILT_RULES = [
    {
        "id": "rule_prebuilt_payment_recovery",
        "name": "Payment Failure Incident Alert",
        "description": "Creates an incident ticket and fires SNS alert on payment decline.",
        "trigger": "PAYMENT_FAILED",
        "category": "Payments",
        "priority": 1,
        "enabled": True,
        "is_prebuilt": True,
        "conditions": [],
        "actions": [
            {"type": "create_incident", "params": {"severity": "high", "title": "Razorpay Payment Decline Incident"}},
            {"type": "aws_sns", "params": {"topic": "payments", "subject": "Payment Failure Spike Alert"}},
        ],
    },
    {
        "id": "rule_prebuilt_low_stock",
        "name": "Low Stock Automated Watchdog",
        "description": "Monitors stock levels, triggers restock alert when items drop below threshold, and creates inventory incident.",
        "trigger": "LOW_STOCK",
        "category": "Inventory",
        "priority": 2,
        "enabled": True,
        "is_prebuilt": True,
        "conditions": [
            {"field": "stock", "operator": "lt", "value": 10}
        ],
        "actions": [
            {"type": "restock_alert", "params": {}},
            {"type": "create_incident", "params": {"severity": "medium", "title": "Inventory Stock Depletion Warning"}},
            {"type": "aws_sns", "params": {"topic": "inventory", "subject": "Low Stock Inventory Alert"}},
        ],
    },
    {
        "id": "rule_prebuilt_revenue_drop",
        "name": "Revenue Drop Anomaly Watchdog",
        "description": "Detects 20%+ revenue drop anomalies compared to weekly baseline and notifies merchant.",
        "trigger": "REVENUE_DROP",
        "category": "Revenue",
        "priority": 1,
        "enabled": True,
        "is_prebuilt": True,
        "conditions": [],
        "actions": [
            {"type": "create_incident", "params": {"severity": "critical", "title": "Significant Revenue Drop Anomaly Detected"}},
            {"type": "aws_sns", "params": {"topic": "incidents", "subject": "Critical Revenue Drop Anomaly"}},
        ],
    },
    {
        "id": "rule_prebuilt_vip_reward",
        "name": "VIP Repeat Buyer Auto-Reward",
        "description": "Generates exclusive VIP coupon reward when repeat customer completes order.",
        "trigger": "REPEAT_CUSTOMER",
        "category": "Customer",
        "priority": 4,
        "enabled": True,
        "is_prebuilt": True,
        "conditions": [],
        "actions": [
            {"type": "generate_coupon", "params": {"code_prefix": "VIPPERK20", "discount_pct": 20}},
            {"type": "email_campaign", "params": {"subject": "Thank you for being a valued VIP customer!"}},
        ],
    },
    {
        "id": "rule_prebuilt_webhook_retry",
        "name": "Webhook Failure Incident Guard",
        "description": "Flags failed Razorpay webhook signature or delivery retries for merchant audit.",
        "trigger": "WEBHOOK_RETRY",
        "category": "Webhooks",
        "priority": 2,
        "enabled": True,
        "is_prebuilt": True,
        "conditions": [],
        "actions": [
            {"type": "create_incident", "params": {"severity": "high", "title": "Razorpay Webhook Delivery Failure"}},
        ],
    },
    {
        "id": "rule_prebuilt_daily_summary",
        "name": "8 AM Daily Business Operations Report",
        "description": "Generates daily business operations summary and triggers AWS Lambda report export.",
        "trigger": "SCHEDULED_DAILY",
        "category": "Time Schedule",
        "priority": 5,
        "enabled": True,
        "is_prebuilt": True,
        "conditions": [],
        "actions": [
            {"type": "aws_lambda", "params": {"function": "revenuepilot-daily-report"}},
            {"type": "email_campaign", "params": {"subject": "Your Daily RevenuePilot Operations Summary"}},
        ],
    },
]


class AutomationEngine:
    def __init__(self):
        pass

    async def initialize_prebuilt_rules(self):
        """
        Seed prebuilt workflow rules into MongoDB if collection is empty.
        """
        db = get_mongodb()
        count = await db.automation_rules.count_documents({})
        if count == 0:
            logger.info("Seeding prebuilt automation workflow templates into MongoDB")
            for rule_dict in DEFAULT_PREBUILT_RULES:
                rule_dict["created_at"] = datetime.utcnow().isoformat()
                rule_dict["execution_count"] = 0
                await db.automation_rules.insert_one(rule_dict)

    async def process_event(self, event: EventRecord):
        """
        Processes an incoming business event against all active automation rules.
        Also publishes event to AWS EventBridge, pushes metric to CloudWatch, and logs to CloudWatch Logs.
        """
        db = get_mongodb()
        await self.initialize_prebuilt_rules()

        # Requirement 8 — Publish event to AWS EventBridge
        eb_res = publish_event(
            event_type=event.event_type,
            detail=event.payload,
            source=f"revenuepilot.{event.source or 'autoops'}",
        )

        # Requirement 8 — Push metric to CloudWatch
        put_metric(
            metric_name="AutoOpsEventsProcessed",
            value=1.0,
            unit="Count",
            dimensions={"EventType": event.event_type, "Severity": event.severity or "info"},
        )

        # Requirement 8 — Push log event to CloudWatch Logs
        put_log_event(
            message=f"[AutoOps Event] Type: {event.event_type} | Source: {event.source} | EventID: {event.event_id} | Status: {eb_res.get('status')}"
        )

        # Find enabled rules matching this event_type or trigger
        cursor = db.automation_rules.find({
            "enabled": True,
            "$or": [
                {"trigger": event.event_type},
                {"trigger": "ALL_EVENTS"}
            ]
        }).sort("priority", 1)

        matching_rules = await cursor.to_list(length=100)
        logger.info(f"Evaluating {len(matching_rules)} automation rules for event {event.event_type}")

        for rule in matching_rules:
            await self._evaluate_and_execute(rule, event)

    async def _evaluate_and_execute(self, rule_dict: Dict[str, Any], event: EventRecord):
        start_time = time.time()
        rule_id = str(rule_dict.get("_id") or rule_dict.get("id"))
        rule_name = rule_dict.get("name", "Unnamed Rule")
        conditions = rule_dict.get("conditions", [])
        actions = rule_dict.get("actions", [])

        # Check conditions
        if not self._check_conditions(conditions, event.payload):
            logger.info("Rule conditions did not match payload", rule_name=rule_name)
            return

        # Execute actions
        action_results = []
        aws_statuses = []

        for action in actions:
            action_type = action.get("type")
            params = action.get("params", {})
            res = await self._execute_action(action_type, params, event)
            action_results.append(f"{action_type}: {res.get('status', 'ok')}")
            if "aws" in action_type:
                aws_statuses.append(res.get("status", "ok"))

        duration_ms = round((time.time() - start_time) * 1000, 2)
        exec_id = f"exec_{uuid.uuid4().hex[:12]}"
        aws_pub_status = aws_statuses[0] if aws_statuses else "success"

        # Record CloudWatch metric for rule execution
        put_metric(
            metric_name="RuleExecutionsCount",
            value=1.0,
            unit="Count",
            dimensions={"RuleName": rule_name, "Trigger": event.event_type},
        )
        put_metric(
            metric_name="RuleExecutionLatencyMs",
            value=duration_ms,
            unit="Milliseconds",
            dimensions={"RuleName": rule_name},
        )

        exec_log = ExecutionLog(
            execution_id=exec_id,
            automation_id=rule_id,
            rule_name=rule_name,
            trigger=event.event_type,
            event_id=event.event_id,
            status="success",
            result_detail="; ".join(action_results),
            duration_ms=duration_ms,
            timestamp=datetime.utcnow().isoformat(),
            aws_publish_status=aws_pub_status,
            mongo_write_status="success",
            retry_count=0,
        )

        db = get_mongodb()
        await db.execution_history.insert_one(exec_log.dict())

        # Update rule statistics
        await db.automation_rules.update_one(
            {"_id": rule_dict.get("_id") or rule_id},
            {
                "$inc": {"execution_count": 1},
                "$set": {"last_triggered_at": datetime.utcnow().isoformat()}
            }
        )

        logger.info("Automation rule executed successfully", rule_name=rule_name, duration_ms=duration_ms)

    def _check_conditions(self, conditions: List[Dict[str, Any]], payload: Dict[str, Any]) -> bool:
        if not conditions:
            return True

        for cond in conditions:
            field = cond.get("field")
            operator = cond.get("operator")
            target_val = cond.get("value")
            actual_val = payload.get(field)

            if actual_val is None:
                return False

            if operator in ["gt", ">"]:
                if not (actual_val > target_val):
                    return False
            elif operator in ["lt", "<"]:
                if not (actual_val < target_val):
                    return False
            elif operator in ["gte", ">="]:
                if not (actual_val >= target_val):
                    return False
            elif operator in ["lte", "<="]:
                if not (actual_val <= target_val):
                    return False
            elif operator in ["eq", "=="]:
                if not (actual_val == target_val):
                    return False
            elif operator == "contains":
                if str(target_val).lower() not in str(actual_val).lower():
                    return False

        return True

    async def _execute_action(self, action_type: str, params: Dict[str, Any], event: EventRecord) -> Dict[str, Any]:
        db = get_mongodb()

        if action_type == "create_incident":
            incident = {
                "id": f"inc_{uuid.uuid4().hex[:8]}",
                "severity": params.get("severity", "medium"),
                "title": params.get("title", f"AutoOps Incident: {event.event_type}"),
                "description": f"Triggered by event {event.event_id}. Payload: {event.payload}",
                "source": "AutoOps Automation Engine",
                "status": "open",
                "created_at": datetime.utcnow().isoformat(),
            }
            await db.incidents.insert_one(incident)
            put_metric(metric_name="IncidentsCreated", value=1.0, unit="Count")
            return {"status": "created_incident", "incident_id": incident["id"]}

        elif action_type == "queue_recovery":
            # Event-driven automatic recovery queueing is disabled per Target Architecture.
            # Recovery AI runs manually via 'POST /automation/recovery/analyze'.
            return {"status": "manual_analyze_only", "message": "Automatic event-driven recovery disabled"}

        elif action_type == "generate_coupon":
            coupon = {
                "code": f"{params.get('code_prefix', 'SAVE')}_{uuid.uuid4().hex[:4].upper()}",
                "discount_pct": params.get("discount_pct", 10),
                "event_id": event.event_id,
                "status": "active",
                "created_at": datetime.utcnow().isoformat(),
            }
            await db.coupons.insert_one(coupon)
            return {"status": "generated_coupon", "code": coupon["code"]}

        elif action_type == "restock_alert":
            product_id = event.payload.get("product_id")
            if product_id:
                await db.products.update_one(
                    {"$or": [{"_id": product_id}, {"id": product_id}]},
                    {"$set": {"needs_restock": True, "restock_flagged_at": datetime.utcnow().isoformat()}}
                )
            return {"status": "restock_alert_flagged"}

        elif action_type == "aws_sns":
            topic = params.get("topic", "payments")
            subject = params.get("subject", f"AutoOps Alert: {event.event_type}")
            msg = f"AutoOps Alert [{event.event_type}] EventID={event.event_id}: {subject}"
            target_email = event.payload.get("customer_email") or event.payload.get("email") or "jpnishath@gmail.com"
            sns_res = send_notification(topic_type_or_arn=topic, message=msg, subject=subject, recipient_email=target_email)
            put_metric(metric_name="SNSEventsPublished", value=1.0, unit="Count", dimensions={"Topic": topic})
            return sns_res

        elif action_type == "aws_eventbridge":
            eb_res = publish_event(event_type=event.event_type, detail=event.payload)
            put_metric(metric_name="EventBridgeEventsPublished", value=1.0, unit="Count")
            return eb_res

        elif action_type == "aws_lambda":
            fn = params.get("function", "revenuepilot-recovery-lambda")
            lam_res = aws_manager.invoke_lambda(function_name=fn, payload=event.payload)
            put_metric(metric_name="LambdaInvocationsCount", value=1.0, unit="Count", dimensions={"Function": fn})
            return lam_res

        elif action_type in ["aws_s3_upload", "upload_report"]:
            filename = params.get("filename", f"report_{event.event_id}.json")
            content = params.get("content", str(event.payload))
            s3_res = upload_report(file_content=content, object_name=filename, content_type="application/json")
            put_metric(metric_name="S3ReportsUploaded", value=1.0, unit="Count")
            return s3_res

        elif action_type in ["email_campaign", "whatsapp_campaign"]:
            return {"status": f"campaign_queued_{action_type}"}

        return {"status": "executed_generic"}

    # Periodic Watchdogs (Tasks 7, 8, 15)
    async def run_inventory_watchdog(self):
        """
        Scans product catalog in MongoDB and emits LOW_STOCK / OUT_OF_STOCK events.
        """
        db = get_mongodb()
        from app.services.event_bus import event_bus

        products = await db.products.find({}).to_list(length=500)
        low_count = 0
        out_count = 0

        for p in products:
            stock = p.get("stock", 0)
            p_name = p.get("name") or p.get("title", "Product SKU")
            if stock == 0:
                out_count += 1
                await event_bus.emit(
                    event_type="OUT_OF_STOCK",
                    payload={"product_name": p_name, "stock": 0, "product_id": str(p.get("_id") or p.get("id"))},
                    severity="critical"
                )
            elif stock <= 5:
                low_count += 1
                await event_bus.emit(
                    event_type="LOW_STOCK",
                    payload={"product_name": p_name, "stock": stock, "product_id": str(p.get("_id") or p.get("id"))},
                    severity="warning"
                )

        put_metric(metric_name="InventoryWatchdogLowStock", value=float(low_count), unit="Count")
        put_metric(metric_name="InventoryWatchdogOutOfStock", value=float(out_count), unit="Count")
        logger.info("Inventory Watchdog scan complete", low_stock=low_count, out_of_stock=out_count)
        return {"low_stock": low_count, "out_of_stock": out_count}

    async def run_revenue_watchdog(self):
        """
        Monitors revenue anomaly metrics and emits REVENUE_DROP or REVENUE_SPIKE.
        """
        db = get_mongodb()
        from app.services.event_bus import event_bus
        from app.services.analytics import analytics_service

        today_metrics = await analytics_service.get_today_metrics()
        growth = today_metrics.get("revenue", {}).get("growth_percentage", 0)

        if growth <= -20.0:
            await event_bus.emit(
                event_type="REVENUE_DROP",
                payload={"growth_percentage": growth, "current_revenue": today_metrics.get("revenue", {}).get("today", 0)},
                severity="critical"
            )
        elif growth >= 30.0:
            await event_bus.emit(
                event_type="REVENUE_SPIKE",
                payload={"growth_percentage": growth, "current_revenue": today_metrics.get("revenue", {}).get("today", 0)},
                severity="info"
            )

        put_metric(metric_name="RevenueGrowthPercentage", value=float(growth), unit="Percent")
        logger.info("Revenue Watchdog scan complete", growth_percentage=growth)
        return {"growth_percentage": growth}


# Singleton instance
automation_engine = AutomationEngine()
