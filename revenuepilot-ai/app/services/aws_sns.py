"""
RevenuePilot AI — AWS SNS Notification Integration
Sends real-time alerts and SNS notifications with local fallback support.
"""
from typing import Any, Dict, Optional
import time

from app.core.config import settings
from app.core.logging import get_logger
from app.services.aws_client import aws_client

logger = get_logger(__name__)


def send_notification(
    topic_type_or_arn: str,
    message: str,
    subject: str = "RevenuePilot AutoOps Alert",
) -> Dict[str, Any]:
    """
    Requirement 5 — Send alert notification via AWS SNS.
    Falls back gracefully if AWS credentials are missing or AWS_MODE=local.
    """
    if aws_client.is_local_mode or not aws_client.sns_client:
        logger.info(
            "AWS SNS running in Local Fallback Mode",
            topic=topic_type_or_arn,
            subject=subject,
            message_snippet=message[:60],
        )
        return {
            "status": "published_local_fallback",
            "topic": topic_type_or_arn,
            "message_id": f"local-sns-{int(time.time() * 1000)}",
            "subject": subject,
            "mode": "local",
        }

    # Resolve Topic ARN
    topic_arn = ""
    if topic_type_or_arn.startswith("arn:aws:sns:"):
        topic_arn = topic_type_or_arn
    else:
        setting_key = f"AWS_SNS_TOPIC_ARN_{topic_type_or_arn.upper()}"
        topic_arn = getattr(settings, setting_key, "") or getattr(settings, "AWS_SNS_TOPIC_ARN", "")

    if not topic_arn:
        logger.info(
            "AWS SNS Topic ARN not configured — running in local broadcast mode",
            topic=topic_type_or_arn,
        )
        return {
            "status": "published_local_fallback",
            "topic": topic_type_or_arn,
            "reason": "topic_arn_missing",
            "message_id": f"local-sns-{int(time.time() * 1000)}",
            "mode": "local",
        }

    try:
        # Subject limit for SNS is 100 characters
        sanitized_subject = subject[:95]
        res = aws_client.sns_client.publish(
            TopicArn=topic_arn,
            Message=message,
            Subject=sanitized_subject,
        )
        message_id = res.get("MessageId", "unknown")
        logger.info("SNS notification published successfully", message_id=message_id, topic_arn=topic_arn)
        return {
            "status": "published",
            "message_id": message_id,
            "topic_arn": topic_arn,
            "mode": "cloud",
        }
    except Exception as err:
        logger.error("SNS publish exception", error=str(err), topic_arn=topic_arn)
        return {
            "status": "failed_fallback_local",
            "error": str(err),
            "mode": "cloud_error",
        }
