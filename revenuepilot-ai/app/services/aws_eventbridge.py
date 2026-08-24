"""
RevenuePilot AI — AWS EventBridge Integration
Publishes business & operational events to AWS EventBridge with local fallback support.
"""
from typing import Any, Dict, Optional
import json
import time

from app.core.config import settings
from app.core.logging import get_logger
from app.services.aws_client import aws_client

logger = get_logger(__name__)


def publish_event(
    event_type: str,
    detail: Dict[str, Any],
    source: str = "revenuepilot.autoops",
    event_bus_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Requirement 4 — Publish event to AWS EventBridge.
    Falls back gracefully if AWS credentials are missing or AWS_MODE=local.
    """
    bus = event_bus_name or settings.EVENT_BUS_NAME

    if aws_client.is_local_mode or not aws_client.events_client:
        logger.info(
            "AWS EventBridge running in Local Fallback Mode",
            event_type=event_type,
            source=source,
            bus=bus,
        )
        return {
            "status": "published_local_fallback",
            "event_bus": bus,
            "aws_event_id": f"local-eb-{int(time.time() * 1000)}",
            "event_type": event_type,
            "mode": "local",
        }

    try:
        entry = {
            "Source": source,
            "DetailType": event_type,
            "Detail": json.dumps(detail, default=str),
            "EventBusName": bus,
        }

        res = aws_client.events_client.put_events(Entries=[entry])
        failed_entry_count = res.get("FailedEntryCount", 0)

        if failed_entry_count > 0:
            logger.error("EventBridge put_events returned failures", response=res)
            return {
                "status": "failed_fallback_local",
                "detail": "EventBridge put_events returned failure",
                "mode": "cloud_failed",
            }

        event_id = res.get("Entries", [{}])[0].get("EventId", "unknown")
        logger.info("EventBridge event published successfully", event_id=event_id, bus=bus)
        return {
            "status": "published",
            "event_bus": bus,
            "aws_event_id": event_id,
            "event_type": event_type,
            "mode": "cloud",
        }
    except Exception as err:
        logger.error("EventBridge publish exception", error=str(err))
        return {
            "status": "failed_fallback_local",
            "error": str(err),
            "mode": "cloud_error",
        }


class AWSServiceManager:
    """
    Compatibility wrapper for legacy code relying on AWSServiceManager instance.
    """

    def __init__(self):
        pass

    @property
    def has_credentials(self) -> bool:
        return not aws_client.is_local_mode

    @property
    def event_bus_name(self) -> str:
        return settings.EVENT_BUS_NAME

    def publish_eventbridge(
        self,
        event_type: str,
        detail: Dict[str, Any],
        source: str = "revenuepilot.merchant",
    ) -> Dict[str, Any]:
        return publish_event(event_type=event_type, detail=detail, source=source)

    def publish_sns(
        self,
        topic_type: str,
        message: str,
        subject: str = "RevenuePilot AutoOps Alert",
    ) -> Dict[str, Any]:
        from app.services.aws_sns import send_notification
        return send_notification(topic_type_or_arn=topic_type, message=message, subject=subject)

    def invoke_lambda(
        self,
        function_name: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        if aws_client.is_local_mode or not aws_client.lambda_client:
            logger.info("AWS Lambda running in Local Fallback Mode", function=function_name)
            return {
                "status": "invoked_local_fallback",
                "function": function_name,
                "response": {"result": "local_simulated_success", "payload": payload},
            }

        try:
            res = aws_client.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType="Event",  # Asynchronous
                Payload=json.dumps(payload, default=str),
            )
            return {"status": "invoked", "status_code": res.get("StatusCode")}
        except Exception as err:
            logger.error("Lambda invocation exception", error=str(err))
            return {"status": "failed_fallback_local", "error": str(err)}

    def get_health_status(self) -> Dict[str, Any]:
        health = aws_client.verify_connectivity()
        return {
            "mode": "AWS Cloud Mode" if not aws_client.is_local_mode else "Local Event Bus Mode",
            "region": aws_client.region,
            "has_credentials": not aws_client.is_local_mode,
            "boto3_installed": health.get("boto3_installed", False),
            "eventbridge": {
                "status": health["services"]["eventbridge"]["status"],
                "bus_name": settings.EVENT_BUS_NAME,
            },
            "sns": {
                "status": health["services"]["sns"]["status"],
            },
            "lambda": {
                "status": health["services"]["lambda"]["status"],
            },
            "s3": {
                "status": health["services"]["s3"]["status"],
            },
            "cloudwatch": {
                "status": health["services"]["cloudwatch"]["status"],
            },
        }


# Global singleton instance
aws_manager = AWSServiceManager()
