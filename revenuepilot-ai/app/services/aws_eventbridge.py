"""
RevenuePilot AI — AWS EventBridge, SNS & Lambda Integration Layer
Supports graceful local fallback when AWS credentials are not configured.
"""
from typing import Any, Dict, Optional
import json
import time
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Lazy load boto3 if available
try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.info("boto3 not installed — AWS services will run in Local Fallback Mode")


class AWSServiceManager:
    def __init__(self):
        self.region = settings.AWS_REGION
        self.access_key = settings.AWS_ACCESS_KEY_ID
        self.secret_key = settings.AWS_SECRET_ACCESS_KEY
        self.event_bus_name = settings.EVENT_BUS_NAME
        
        self.has_credentials = bool(self.access_key and self.secret_key and BOTO3_AVAILABLE)
        
        self._events_client = None
        self._sns_client = None
        self._lambda_client = None

        if self.has_credentials:
            try:
                session = boto3.Session(
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region,
                )
                self._events_client = session.client('events')
                self._sns_client = session.client('sns')
                self._lambda_client = session.client('lambda')
            except Exception as err:
                logger.warning("Failed to initialize AWS boto3 clients", error=str(err))
                self.has_credentials = False

    def publish_eventbridge(self, event_type: str, detail: Dict[str, Any], source: str = "revenuepilot.merchant") -> Dict[str, Any]:
        """
        Task 10 — Publish event to AWS EventBridge. Fallback to local if credentials missing.
        """
        if not self.has_credentials or not self._events_client:
            logger.info("AWS EventBridge running in Local Fallback Mode", event_type=event_type)
            return {
                "status": "published_local_fallback",
                "event_bus": "local-event-bus",
                "aws_event_id": f"local-{int(time.time()*1000)}",
            }

        try:
            entry = {
                'Source': source,
                'DetailType': event_type,
                'Detail': json.dumps(detail),
                'EventBusName': self.event_bus_name,
            }
            res = self._events_client.put_events(Entries=[entry])
            failed_entry_count = res.get('FailedEntryCount', 0)

            if failed_entry_count > 0:
                logger.error("EventBridge put_events failed", response=res)
                return {"status": "failed_fallback_local", "detail": "EventBridge put_events returned failure"}

            event_id = res['Entries'][0].get('EventId', 'unknown')
            logger.info("EventBridge published successfully", event_id=event_id)
            return {"status": "published", "event_bus": self.event_bus_name, "aws_event_id": event_id}
        except Exception as err:
            logger.error("EventBridge publish exception", error=str(err))
            return {"status": "failed_fallback_local", "error": str(err)}

    def publish_sns(self, topic_type: str, message: str, subject: str = "RevenuePilot AutoOps Alert") -> Dict[str, Any]:
        """
        Task 11 — Publish alert notification via AWS SNS.
        """
        if not self.has_credentials or not self._sns_client:
            logger.info("AWS SNS running in Local Fallback Mode", topic=topic_type, message=message[:50])
            return {"status": "published_local_fallback", "topic": f"local-{topic_type}"}

        topic_arn = getattr(settings, f"AWS_SNS_TOPIC_ARN_{topic_type.upper()}", "")
        if not topic_arn:
            logger.info("AWS SNS Topic ARN not set — using local broadcast", topic=topic_type)
            return {"status": "published_local_fallback", "reason": "topic_arn_missing"}

        try:
            res = self._sns_client.publish(
                TopicArn=topic_arn,
                Message=message,
                Subject=subject[:90]
            )
            return {"status": "published", "message_id": res.get('MessageId')}
        except Exception as err:
            logger.error("SNS publish exception", error=str(err))
            return {"status": "failed_fallback_local", "error": str(err)}

    def invoke_lambda(self, function_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Task 12 — Invoke AWS Lambda function. Fallback locally if credentials missing.
        """
        if not self.has_credentials or not self._lambda_client:
            logger.info("AWS Lambda running in Local Fallback Mode", function=function_name)
            return {
                "status": "invoked_local_fallback",
                "function": function_name,
                "response": {"result": "local_simulated_success", "payload": payload}
            }

        try:
            res = self._lambda_client.invoke(
                FunctionName=function_name,
                InvocationType='Event',  # Asynchronous
                Payload=json.dumps(payload)
            )
            return {"status": "invoked", "status_code": res.get('StatusCode')}
        except Exception as err:
            logger.error("Lambda invocation exception", error=str(err))
            return {"status": "failed_fallback_local", "error": str(err)}

    def get_health_status(self) -> Dict[str, Any]:
        """
        Task 17 — AWS Integration status for Settings Page & Monitoring Dashboard.
        """
        return {
            "mode": "AWS EventBridge Mode" if self.has_credentials else "Local Event Bus Mode",
            "region": self.region,
            "has_credentials": self.has_credentials,
            "boto3_installed": BOTO3_AVAILABLE,
            "eventbridge": {
                "status": "CONNECTED" if self.has_credentials else "LOCAL_FALLBACK",
                "bus_name": self.event_bus_name,
            },
            "sns": {
                "status": "CONNECTED" if self.has_credentials else "LOCAL_FALLBACK",
            },
            "lambda": {
                "status": "CONNECTED" if self.has_credentials else "LOCAL_FALLBACK",
            },
            "cloudwatch": {
                "status": "CONNECTED" if self.has_credentials else "LOCAL_FALLBACK",
            }
        }


# Singleton instance
aws_manager = AWSServiceManager()
