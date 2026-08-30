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
    recipient_email: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Requirement 5 — Send alert notification via AWS SNS.
    Dispatches to target email recipient (default: jpnishath@gmail.com) for testing & audit.
    Falls back gracefully if AWS credentials are missing or AWS_MODE=local.
    """
    target_email = recipient_email or getattr(settings, "NOTIFICATION_EMAIL", "jpnishath@gmail.com")

    if aws_client.is_local_mode or not aws_client.sns_client:
        logger.info(
            "AWS SNS running in Local Fallback Mode",
            topic=topic_type_or_arn,
            subject=subject,
            recipient_email=target_email,
            message_snippet=message[:60],
        )
        return {
            "status": "published_local_fallback",
            "topic": topic_type_or_arn,
            "recipient_email": target_email,
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
            recipient_email=target_email,
        )
        return {
            "status": "published_local_fallback",
            "topic": topic_type_or_arn,
            "recipient_email": target_email,
            "reason": "topic_arn_missing",
            "message_id": f"local-sns-{int(time.time() * 1000)}",
            "mode": "local",
        }

    try:
        # Subject limit for SNS is 100 characters
        sanitized_subject = subject[:95]
        # Append target recipient email attribute if AWS SNS client supports attributes
        res = aws_client.sns_client.publish(
            TopicArn=topic_arn,
            Message=f"{message}\n\n[Notification Target Email: {target_email}]",
            Subject=sanitized_subject,
            MessageAttributes={
                "recipient_email": {
                    "DataType": "String",
                    "StringValue": target_email,
                }
            }
        )
        message_id = res.get("MessageId", "unknown")
        logger.info("SNS notification published successfully", message_id=message_id, topic_arn=topic_arn, recipient_email=target_email)
        return {
            "status": "published",
            "message_id": message_id,
            "topic_arn": topic_arn,
            "recipient_email": target_email,
            "mode": "cloud",
        }
    except Exception as err:
        logger.error("SNS publish exception", error=str(err), topic_arn=topic_arn, recipient_email=target_email)
        return {
            "status": "failed_fallback_local",
            "error": str(err),
            "recipient_email": target_email,
            "mode": "cloud_error",
        }
