"""
RevenuePilot AWS Lambda — IncidentLambda (v3.0 Refactored)
Creates operational incident records, validates severity levels, persists incidents to MongoDB Atlas,
dispatches SNS notifications for HIGH/CRITICAL severities, and emits INCIDENT_CREATED to EventBridge.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
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
    Enforces cooldown deduplication, validates severity levels, persists incidents to MongoDB Atlas,
    tracks incident resolution history, dispatches SNS notifications for HIGH/CRITICAL severities,
    and emits INCIDENT_CREATED to EventBridge.
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
    cooldown_minutes = int(event.get("cooldown_minutes") or 0) if isinstance(event, dict) else 0
    ignore_cooldown = bool(event.get("ignore_cooldown", False)) if isinstance(event, dict) else False

    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()

    # 2. Cooldown check — prevent duplicate incidents within cooldown window when cooldown_minutes > 0
    if db is not None and cooldown_minutes > 0 and not ignore_cooldown:
        try:
            cooldown_cutoff = (now_dt - timedelta(minutes=cooldown_minutes)).isoformat()
            dup_query: Dict[str, Any] = {
                "incident_type": incident_type,
                "status": {"$in": ["OPEN", "open", "PENDING", "pending"]},
                "created_at": {"$gte": cooldown_cutoff}
            }
            if merchant_id and merchant_id != "all":
                dup_query["merchant_id"] = merchant_id

            existing_incident = db.incidents.find_one(dup_query)
            if existing_incident:
                logger.info(f"[IncidentLambda] Cooldown active ({cooldown_minutes}m) for {incident_type}. Skipping duplicate incident creation.")
                existing_id = existing_incident.get("incident_id") or str(existing_incident.get("_id"))
                
                # Append cooldown attempt to history if possible
                try:
                    db.incidents.update_one(
                        {"_id": existing_incident.get("_id")},
                        {"$push": {"history": {
                            "action": "COOLDOWN_SUPPRESSED_DUPLICATE",
                            "timestamp": now_iso,
                            "trace_id": trace_id
                        }}}
                    )
                except Exception:
                    pass

                skipped_result = {
                    "status": "SUCCESS",
                    "function_name": "IncidentLambda",
                    "incident_id": existing_id,
                    "incident_type": incident_type,
                    "severity": severity,
                    "title": title,
                    "merchant_id": merchant_id,
                    "trace_id": trace_id,
                    "sns_alert_published": False,
                    "duplicate_suppressed": True,
                    "reason": f"Incident of type {incident_type} created within past {cooldown_minutes} minutes.",
                    "timestamp": now_iso
                }
                return {
                    "statusCode": 200,
                    "body": json.dumps(skipped_result)
                }
        except Exception as err:
            logger.warning(f"[IncidentLambda] Cooldown query check failed: {err}")

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
        "resolved_at": None,
        "resolution": None,
        "closed_by": None,
        "history": [
            {
                "action": "INCIDENT_CREATED",
                "status": "OPEN",
                "timestamp": now_iso,
                "by": "AutoOps Watchdog",
                "trace_id": trace_id
            }
        ],
        "created_at": now_iso,
        "timestamp": now_iso
    }

    # 3. Persist Incident into MongoDB Atlas
    if db is not None:
        try:
            db.incidents.insert_one(incident_record)
        except Exception as err:
            logger.warning(f"[IncidentLambda] Mongo insert warning: {err}")

    # 4. Notify SNS ONLY for HIGH / CRITICAL severities
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
                        "merchant_id": merchant_id,
                        "subject": f"[{severity.upper()}] RevenuePilot Incident: {title}",
                        "message": json.dumps(serialize_bson(incident_record), indent=2),
                        "status": "SIMULATED_LOCAL",
                        "created_at": now_iso,
                        "timestamp": now_iso
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

    # 5. Prepare Result & Emit EventBridge
    execution_result = {
        "status": "SUCCESS",
        "function_name": "IncidentLambda",
        "incident_id": incident_id,
        "severity": severity,
        "title": title,
        "merchant_id": merchant_id,
        "trace_id": trace_id,
        "sns_alert_published": sns_published,
        "timestamp": now_iso
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
