"""
RevenuePilot AI — AWS CloudWatch Metrics & Structured Logging Integration
Pushes custom metrics (Task 9) and structured JSON logs (Task 10) to AWS CloudWatch.
"""
from typing import Any, Dict, Optional
import time
import json

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
    TASK 9 — Push metric to AWS CloudWatch namespace RevenuePilot/AutoOps.
    """
    ns = namespace or settings.AWS_CLOUDWATCH_NAMESPACE

    if aws_client.is_local_mode or not aws_client.cloudwatch_client:
        logger.info(
            "AWS CloudWatch Metric (Local Mode)",
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

        logger.info("CloudWatch metric published", metric_name=metric_name, value=value)
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


def put_structured_log(
    trace_id: str,
    merchant_id: str,
    latency_ms: float,
    status: str,
    action: str,
    severity: str = "info",
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    TASK 10 — Send structured JSON log to log group /revenuepilot/autoops and stream autoops-stream.
    """
    log_doc = {
        "trace_id": trace_id,
        "merchant_id": merchant_id,
        "latency": latency_ms,
        "status": status,
        "action": action,
        "severity": severity,
        "timestamp": time.time(),
        "details": details or {},
    }
    json_message = json.dumps(log_doc)
    return put_log_event(message=json_message)


def put_log_event(
    log_group: Optional[str] = None,
    log_stream: Optional[str] = None,
    message: str = "",
) -> Dict[str, Any]:
    """
    Pushes raw log message to AWS CloudWatch Logs.
    """
    group = log_group or settings.AWS_CLOUDWATCH_LOG_GROUP
    stream = log_stream or settings.AWS_CLOUDWATCH_LOG_STREAM

    if aws_client.is_local_mode or not aws_client.logs_client:
        logger.info(
            "AWS CloudWatch Logs (Local Mode)",
            log_group=group,
            log_stream=stream,
            snippet=message[:80],
        )
        return {
            "status": "log_event_logged_local",
            "log_group": group,
            "log_stream": stream,
            "message": message,
            "mode": "local",
        }

    try:
        try:
            aws_client.logs_client.create_log_group(logGroupName=group)
        except Exception:
            pass

        try:
            aws_client.logs_client.create_log_stream(logGroupName=group, logStreamName=stream)
        except Exception:
            pass

        event = {
            "timestamp": int(time.time() * 1000),
            "message": message,
        }

        aws_client.logs_client.put_log_events(
            logGroupName=group,
            logStreamName=stream,
            logEvents=[event],
        )

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


# Task 9 Metrics Helper Suite
def push_all_metrics(metrics: Dict[str, float], merchant_id: str = "merch_default"):
    dims = {"MerchantId": merchant_id}
    mapping = {
        "OrdersProcessed": "Count",
        "RevenueGenerated": "Count",
        "FailedPayments": "Count",
        "RecoveredPayments": "Count",
        "InventoryAlerts": "Count",
        "LambdaInvocations": "Count",
        "SchedulerExecutions": "Count",
        "WebhookLatency": "Milliseconds",
        "DatabaseLatency": "Milliseconds",
        "PaymentSuccessRate": "Percent",
    }
    results = {}
    for k, v in metrics.items():
        unit = mapping.get(k, "Count")
        results[k] = put_metric(metric_name=k, value=float(v), unit=unit, dimensions=dims)
    return results
