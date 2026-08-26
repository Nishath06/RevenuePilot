"""
RevenuePilot AWS Lambda — IncidentLambda
Logs operational incidents and dispatches critical alert notifications via AWS SNS / EventBridge.
Triggered by: Watchdog scanners, EventBridge rule triggers, or API Gateway.
"""

import os
import json
import logging
import uuid
from datetime import datetime, timezone
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sns_client = boto3.client('sns')
eventbridge_client = boto3.client('events')

SNS_TOPIC_ARN = os.environ.get("SNS_ALERT_TOPIC_ARN", "")
EVENT_BUS_NAME = os.environ.get("EVENTBRIDGE_BUS_NAME", "revenuepilot-event-bus")


def lambda_handler(event, context):
    """
    AWS Lambda entry point for Incident Management.
    """
    logger.info(f"IncidentLambda invoked with event: {json.dumps(event)}")
    
    incident_type = event.get("incident_type", "STOCKOUT_ALERT")
    title = event.get("title", "Operational Incident Detected")
    description = event.get("description", "An anomaly was detected by the RevenuePilot Watchdog Engine.")
    severity = event.get("severity", "high").lower()
    merchant_id = event.get("merchant_id", "merch_default")

    incident_id = f"inc_{uuid.uuid4().hex[:10]}"
    timestamp = datetime.now(timezone.utc).isoformat()

    incident_record = {
        "incident_id": incident_id,
        "function_name": "IncidentLambda",
        "incident_type": incident_type,
        "title": title,
        "description": description,
        "severity": severity,
        "merchant_id": merchant_id,
        "status": "OPEN",
        "created_at": timestamp,
    }

    # Dispatch SNS alert for high/critical incidents
    sns_published = False
    if SNS_TOPIC_ARN and severity in ["high", "critical"]:
        try:
            sns_client.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=f"[{severity.upper()}] RevenuePilot Incident: {title}",
                Message=json.dumps(incident_record, indent=2)
            )
            sns_published = True
            logger.info(f"Dispatched incident alert to SNS topic {SNS_TOPIC_ARN}")
        except Exception as err:
            logger.warning(f"SNS publish fallback: {str(err)}")

    # Emit event to EventBridge
    try:
        eventbridge_client.put_events(
            Entries=[{
                'Source': 'revenuepilot.incidents.lambda',
                'DetailType': 'INCIDENT_CREATED',
                'Detail': json.dumps(incident_record),
                'EventBusName': EVENT_BUS_NAME
            }]
        )
    except Exception as err:
        logger.warning(f"EventBridge publish fallback: {str(err)}")

    return {
        "statusCode": 200,
        "body": json.dumps({
            "status": "SUCCESS",
            "incident": incident_record,
            "sns_alert_published": sns_published
        })
    }
