"""
RevenuePilot AWS Lambda — IncidentLambda (v3.0 Refactored)
Creates operational incident records, validates severity levels, persists incidents to MongoDB Atlas,
dispatches SNS notifications for HIGH/CRITICAL severities, and emits INCIDENT_CREATED to EventBridge.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from aws_lambda.utils.aws_lambda_base import (
    get_database,
    serialize_bson,
    get_boto3_client,
    publish_eventbridge_event,
    handle_lambda_exceptions,
    config,
    logger
)


def validate_severity(severity_input: Optional[str]) -> str:
    """Validates and normalizes incident severity level."""
    if not severity_input or not isinstance(severity_input, str):
        return "medium"
    sev = severity_input.strip().lower()
    return sev if sev in ["low", "medium", "high", "critical"] else "medium"


@handle_lambda_exceptions("IncidentLambda")
def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    AWS Lambda entry point for Operational Incident Management.
    """
    db = get_database()
    merchant_id = event.get("merchant_id", "merch_default") if isinstance(event, dict) else "merch_default"
    trace_id = event.get("trace_id") if isinstance(event, dict) else None
    if not trace_id and context and hasattr(context, "aws_request_id"):
        trace_id = context.aws_request_id

    # 1. Parse & Validate Payload
    incident_type = str(event.get("incident_type") or event.get("type") or "STOCKOUT_ALERT")
    title = str(event.get("title") or event.get("name") or "Operational Incident Detected")
    description = str(event.get("description") or "Automated operational anomaly detected by Watchdog Engine.")
    severity = validate_severity(event.get("severity"))

    now_dt = datetime.now(timezone.utc)
    date_str = now_dt.strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:4].upper()
    incident_id = f"INC-{date_str}-{random_suffix}"

    incident_record = {
        "incident_id": incident_id,
        "id": incident_id,
        "function_name": "IncidentLambda",
        "merchant_id": merchant_id,
        "incident_type": incident_type,
        "title": title,
        "description": description,
        "severity": severity,
        "status": "OPEN",
        "assigned_to": "AutoOps Resolution Agent",
        "source": event.get("source", "RevenuePilot Watchdog Engine"),
        "created_at": now_dt.isoformat(),
        "timestamp": now_dt.isoformat()
    }

    # 2. Persist Incident into MongoDB Atlas
    if db is not None:
        try:
            db.incidents.insert_one(incident_record)
        except Exception as err:
            logger.warning(f"[IncidentLambda] Mongo insert warning: {err}")

    # 3. Notify SNS for HIGH / CRITICAL severities
    sns_client = get_boto3_client("sns")
    sns_published = False

    if severity in ["high", "critical"]:
        if config.is_local_mode or not sns_client:
            sns_published = True
            if db is not None:
                try:
                    db.sns_notifications.insert_one({
                        "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
                        "incident_id": incident_id,
                        "subject": f"[{severity.upper()}] RevenuePilot Incident: {title}",
                        "message": json.dumps(serialize_bson(incident_record), indent=2),
                        "status": "SIMULATED_LOCAL",
                        "created_at": now_dt.isoformat()
                    })
                except Exception:
                    pass
        else:
            if config.sns_topic_arn:
                for attempt in range(1, 3):
                    try:
                        sns_client.publish(
                            TopicArn=config.sns_topic_arn,
                            Subject=f"[{severity.upper()}] RevenuePilot Incident: {title}",
                            Message=json.dumps(serialize_bson(incident_record), indent=2)
                        )
                        sns_published = True
                        break
                    except Exception as err:
                        logger.warning(f"[IncidentLambda] SNS attempt {attempt} failed: {err}")

    # 4. Prepare Result & Emit EventBridge
    execution_result = {
        "status": "SUCCESS",
        "function_name": "IncidentLambda",
        "incident_id": incident_id,
        "severity": severity,
        "title": title,
        "merchant_id": merchant_id,
        "trace_id": trace_id,
        "sns_alert_published": sns_published,
        "timestamp": now_dt.isoformat()
    }

    publish_eventbridge_event(
        db=db,
        event_type="INCIDENT_CREATED",
        detail=execution_result,
        source="revenuepilot.incidents.lambda",
        merchant_id=merchant_id,
        trace_id=trace_id
    )

    return {
        "statusCode": 200,
        "body": json.dumps(execution_result)
    }
