"""
RevenuePilot AI — AWS CloudWatch Metrics & Logging Integration
Pushes custom operational metrics and structured log events to CloudWatch with local fallback support.
"""
from typing import Any, Dict, Optional
import time

from app.core.config import settings
from app.core.logging import get_logger
from app.services.aws_client import aws_client

logger = get_logger(__name__)


def put_metric(
    metric_name: str,
    value: float,
    unit: str = "Count",
    dimensions: Optional[Dict[str, str]] = None,
    namespace: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Requirement 7 — Push metric to AWS CloudWatch.
    Falls back gracefully if AWS credentials are missing or AWS_MODE=local.
    """
    ns = namespace or settings.AWS_CLOUDWATCH_NAMESPACE

    if aws_client.is_local_mode or not aws_client.cloudwatch_client:
        logger.info(
            "AWS CloudWatch Metric running in Local Fallback Mode",
            namespace=ns,
            metric_name=metric_name,
            value=value,
            unit=unit,
        )
        return {
            "status": "metric_logged_local",
            "metric_name": metric_name,
            "value": value,
            "unit": unit,
            "namespace": ns,
            "dimensions": dimensions or {},
            "mode": "local",
        }

    try:
        dim_list = []
        if dimensions:
            for k, v in dimensions.items():
                dim_list.append({"Name": k, "Value": str(v)})

        metric_data = [{
            "MetricName": metric_name,
            "Value": float(value),
            "Unit": unit,
            "Dimensions": dim_list,
            "Timestamp": time.time(),
        }]

        aws_client.cloudwatch_client.put_metric_data(
            Namespace=ns,
            MetricData=metric_data,
        )

        logger.info("CloudWatch metric pushed successfully", metric_name=metric_name, value=value)
        return {
            "status": "published",
            "metric_name": metric_name,
            "value": value,
            "namespace": ns,
            "mode": "cloud",
        }
    except Exception as err:
        logger.error("CloudWatch put_metric exception", error=str(err), metric_name=metric_name)
        return {
            "status": "failed_fallback_local",
            "error": str(err),
            "metric_name": metric_name,
            "mode": "cloud_error",
        }


def put_log_event(
    log_group: Optional[str] = None,
    log_stream: Optional[str] = None,
    message: str = "",
) -> Dict[str, Any]:
    """
    Requirement 7 — Push log event to AWS CloudWatch Logs.
    Falls back gracefully if AWS credentials are missing or AWS_MODE=local.
    """
    group = log_group or settings.AWS_CLOUDWATCH_LOG_GROUP
    stream = log_stream or settings.AWS_CLOUDWATCH_LOG_STREAM

    if aws_client.is_local_mode or not aws_client.logs_client:
        logger.info(
            "AWS CloudWatch Logs running in Local Fallback Mode",
            log_group=group,
            log_stream=stream,
            message_snippet=message[:60],
        )
        return {
            "status": "log_event_logged_local",
            "log_group": group,
            "log_stream": stream,
            "message": message,
            "mode": "local",
        }

    try:
        # Create group and stream if they don't exist
        try:
            aws_client.logs_client.create_log_group(logGroupName=group)
        except Exception:
            pass  # Already exists or missing permission

        try:
            aws_client.logs_client.create_log_stream(logGroupName=group, logStreamName=stream)
        except Exception:
            pass  # Already exists or missing permission

        event = {
            "timestamp": int(time.time() * 1000),
            "message": message,
        }

        aws_client.logs_client.put_log_events(
            logGroupName=group,
            logStreamName=stream,
            logEvents=[event],
        )

        logger.info("CloudWatch log event pushed successfully", log_group=group, log_stream=stream)
        return {
            "status": "published",
            "log_group": group,
            "log_stream": stream,
            "mode": "cloud",
        }
    except Exception as err:
        logger.error("CloudWatch put_log_event exception", error=str(err))
        return {
            "status": "failed_fallback_local",
            "error": str(err),
            "log_group": group,
            "mode": "cloud_error",
        }
