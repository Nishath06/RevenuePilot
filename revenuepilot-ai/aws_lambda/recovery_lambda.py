"""
RevenuePilot AWS Lambda — Recovery Dispatch Lambda (v4.0 Production)
===================================================================
Standalone AWS Lambda (Python 3.12) for automated recovery candidate message dispatch.
Queries scheduled recovery candidates from MongoDB Atlas, dispatches SES Emails & SNS SMS
messages with retry logic, tracks partial failures, updates MongoDB candidate status & history,
and publishes CloudWatch metrics (EmailsSent, SMSSent, DispatchFailures, DispatchDuration).
"""

import os
import sys
import json
import time
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
    log_json,
    config,
    logger
)


def sanitize_email(email: Optional[str]) -> str:
    """Validates and cleans email addresses."""
    if not email or not isinstance(email, str):
        return ""
    email_clean = email.strip().lower()
    return email_clean if "@" in email_clean and "." in email_clean else ""


def sanitize_phone(phone: Optional[str]) -> str:
    """Sanitizes phone numbers to standard format."""
    if not phone or not isinstance(phone, str):
        return ""
    cleaned = "".join([c for c in phone if c.isdigit() or c == "+"])
    return cleaned if len(cleaned) >= 8 else ""


def send_ses_email(
    ses_client: Any,
    sender: str,
    recipient: str,
    subject: str,
    html_body: str,
    text_body: str,
    max_retries: int = 3
) -> bool:
    """
    Sends email via AWS SES with exponential backoff retries.
    Sends recovery messages directly to candidate + copies to jpnishath@gmail.com & nishath2306@gmail.com.
    Simulates success in local / non-AWS mode.
    """
    recipients = list(dict.fromkeys([r for r in [recipient, "jpnishath@gmail.com", "nishath2306@gmail.com"] if r and "@" in r]))
    if not recipients:
        return False

    if config.is_local_mode or not ses_client:
        logger.info(f"[RecoveryLambda] Local Mode: Simulated email dispatch to {recipients}")
        return True  # Simulated success in local / simulation mode

    for attempt in range(1, max_retries + 1):
        try:
            body_spec: Dict[str, Any] = {}
            if html_body:
                body_spec["Html"] = {"Data": html_body, "Charset": "UTF-8"}
            if text_body or not html_body:
                body_spec["Text"] = {"Data": text_body or html_body, "Charset": "UTF-8"}

            ses_client.send_email(
                Source=sender,
                Destination={"ToAddresses": recipients},
                Message={
                    "Subject": {"Data": subject or "RevenuePilot Recovery Notice", "Charset": "UTF-8"},
                    "Body": body_spec
                }
            )
            return True
        except Exception as err:
            logger.warning(f"[RecoveryLambda] SES email attempt {attempt}/{max_retries} failed for {recipients}: {err}")
            if attempt < max_retries:
                time.sleep(0.3 * (2 ** (attempt - 1)))
    return False


def send_sns_sms(
    sns_client: Any,
    phone: str,
    message: str,
    max_retries: int = 3
) -> bool:
    """
    Sends SMS message via AWS SNS with exponential backoff retries.
    Simulates success in local / non-AWS mode.
    """
    if not phone or len(phone) < 8:
        return False
    if config.is_local_mode or not sns_client:
        return True  # Simulated success in local / simulation mode

    for attempt in range(1, max_retries + 1):
        try:
            sns_client.publish(
                PhoneNumber=phone,
                Message=message
            )
            return True
        except Exception as err:
            logger.warning(f"[RecoveryLambda] SNS SMS attempt {attempt}/{max_retries} failed for {phone}: {err}")
            if attempt < max_retries:
                time.sleep(0.3 * (2 ** (attempt - 1)))
    return False


def publish_cloudwatch_metrics(
    cw_client: Any,
    emails_sent: int,
    sms_sent: int,
    failures: int,
    execution_time_ms: float,
    merchant_id: str = "merch_default"
) -> None:
    """
    Publishes EmailsSent, SMSSent, DispatchFailures, DispatchDuration to AWS CloudWatch.
    """
    namespace = os.environ.get("CLOUDWATCH_NAMESPACE") or getattr(config, "cloudwatch_namespace", "RevenuePilot/AutoOps")
    metric_items = [
        {"MetricName": "EmailsSent", "Value": float(emails_sent), "Unit": "Count"},
        {"MetricName": "SMSSent", "Value": float(sms_sent), "Unit": "Count"},
        {"MetricName": "DispatchFailures", "Value": float(failures), "Unit": "Count"},
        {"MetricName": "DispatchDuration", "Value": float(execution_time_ms), "Unit": "Milliseconds"},
    ]

    if cw_client and not config.is_local_mode:
        try:
            cw_client.put_metric_data(
                Namespace=namespace,
                MetricData=[
                    {
                        "MetricName": m["MetricName"],
                        "Value": m["Value"],
                        "Unit": m["Unit"],
                        "Dimensions": [
                            {"Name": "MerchantID", "Value": merchant_id},
                            {"Name": "Environment", "Value": os.environ.get("ENVIRONMENT", "production")}
                        ]
                    }
                    for m in metric_items
                ]
            )
            logger.info(f"[RecoveryLambda] Successfully published {len(metric_items)} metrics to CloudWatch namespace '{namespace}'")
        except Exception as err:
            logger.warning(f"[RecoveryLambda] Failed to publish CloudWatch metrics: {err}")
    else:
        logger.info(f"[RecoveryLambda] Local telemetry summary: Namespace={namespace} Metrics={metric_items}")


@handle_lambda_exceptions("RecoveryLambda")
def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    AWS Recovery Dispatch Lambda entry point.
    Queries scheduled recovery candidates from MongoDB Atlas, dispatches SES Email & SNS SMS with retry logic,
    handles partial failures, updates MongoDB document fields (status, email_sent_at, sms_sent_at, last_action, message_history),
    publishes CloudWatch metrics, and returns execution JSON summary.
    """
    start_time = time.perf_counter()
    db = get_database()
    merchant_id = event.get("merchant_id", "merch_default") if isinstance(event, dict) else "merch_default"
    trace_id = event.get("trace_id") if isinstance(event, dict) else None
    if not trace_id and context and hasattr(context, "aws_request_id"):
        trace_id = context.aws_request_id
    if not trace_id:
        trace_id = f"trace_{uuid.uuid4().hex[:10]}"

    # Time calculations (Asia/Kolkata timezone)
    tz_kolkata = timezone(timedelta(hours=5, minutes=30))
    now_kolkata = datetime.now(tz_kolkata)
    now_iso_kolkata = now_kolkata.isoformat()
    now_utc = datetime.now(timezone.utc)
    now_iso_utc = now_utc.isoformat()

    # AWS Boto3 Clients
    ses_client = get_boto3_client("ses")
    sns_client = get_boto3_client("sns")
    cw_client = get_boto3_client("cloudwatch")

    sender_email = os.environ.get("SES_SENDER_EMAIL") or getattr(config, "ses_sender_email", "noreply@revenuepilot.ai")

    candidate_docs: List[Dict[str, Any]] = []

    # 1. Check if direct event payload target was supplied (for unit tests / single trigger)
    if isinstance(event, dict) and (event.get("customer_email") or event.get("customer_phone") or event.get("candidate_id")):
        candidate_docs.append({
            "_id": event.get("candidate_id", f"cand_{uuid.uuid4().hex[:8]}"),
            "candidate_id": event.get("candidate_id", f"cand_{uuid.uuid4().hex[:8]}"),
            "customer_id": event.get("customer_id", "cust_001"),
            "customer_name": event.get("customer_name", "Valued Customer"),
            "customer_email": sanitize_email(event.get("customer_email")),
            "customer_phone": sanitize_phone(event.get("customer_phone")),
            "email_subject": event.get("email_subject") or "Complete your purchase with discount!",
            "email_body_html": event.get("email_body_html") or f"<p>Hi {event.get('customer_name', 'Customer')}, complete your order!</p>",
            "email_body_text": event.get("email_body_text") or f"Hi {event.get('customer_name', 'Customer')}, complete your order!",
            "sms_message": event.get("sms_message") or "RevenuePilot: Complete your order now!",
            "merchant_id": merchant_id,
            "status": "SCHEDULED",
            "recovery_status": "UNRECOVERED",
            "scheduled_send_time": now_iso_kolkata,
        })
    elif db is not None:
        try:
            # Query recovery_candidates where:
            # - status == "SCHEDULED" (or "scheduled")
            # - scheduled_send_time <= current time (Asia/Kolkata)
            # - recovery_status != "RECOVERED"
            cand_filter: Dict[str, Any] = {
                "status": {"$in": ["SCHEDULED", "scheduled"]},
                "recovery_status": {"$ne": "RECOVERED"},
                "$or": [
                    {"scheduled_send_time": {"$lte": now_iso_kolkata}},
                    {"scheduled_send_time": {"$lte": now_iso_utc}},
                    {"scheduled_send_time": {"$lte": now_utc}},
                    {"scheduled_send_time": {"$lte": now_kolkata}},
                    {"scheduled_send_time": ""},
                    {"scheduled_send_time": None},
                    {"scheduled_send_time": {"$exists": False}},
                ]
            }
            if merchant_id and merchant_id != "all":
                cand_filter["merchant_id"] = merchant_id

            cursor = db.recovery_candidates.find(cand_filter).limit(100)
            candidate_docs = list(cursor)
            logger.info(f"[RecoveryLambda] Found {len(candidate_docs)} scheduled recovery candidates for dispatch")
        except Exception as err:
            logger.error(f"[RecoveryLambda] Failed to query recovery_candidates from MongoDB: {err}")

    # Fallback to payment failure targets if no scheduled candidates exist and event specified target
    if not candidate_docs and db is not None:
        try:
            cand_filter = {
                "status": {"$in": ["SCHEDULED", "scheduled"]},
                "recovery_status": {"$ne": "RECOVERED"}
            }
            if merchant_id and merchant_id != "all":
                cand_filter["merchant_id"] = merchant_id
            cursor = db.recovery_candidates.find(cand_filter).limit(50)
            candidate_docs = list(cursor)
        except Exception as err:
            logger.warning(f"[RecoveryLambda] Fallback query error: {err}")

    candidates_processed = len(candidate_docs)
    emails_sent = 0
    sms_sent = 0
    failures = 0

    # Dispatch loop
    for candidate in candidate_docs:
        cand_id = candidate.get("candidate_id") or str(candidate.get("_id"))
        cust_email = sanitize_email(candidate.get("customer_email") or candidate.get("email"))
        cust_phone = sanitize_phone(candidate.get("customer_phone") or candidate.get("phone"))
        cust_name = candidate.get("customer_name") or candidate.get("name") or "Valued Customer"

        subject = candidate.get("email_subject") or "Complete your transaction with RevenuePilot"
        html_body = candidate.get("email_body_html") or f"<p>Hi {cust_name}, complete your transaction today!</p>"
        text_body = candidate.get("email_body_text") or f"Hi {cust_name}, complete your transaction today!"
        sms_msg = candidate.get("sms_message") or "RevenuePilot: Complete your order today!"

        # Dispatch SES email with retries
        email_success = send_ses_email(
            ses_client=ses_client,
            sender=sender_email,
            recipient=cust_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            max_retries=3
        )
        if email_success:
            emails_sent += 1

        # Dispatch SNS SMS with retries
        sms_success = send_sns_sms(
            sns_client=sns_client,
            phone=cust_phone,
            message=sms_msg,
            max_retries=3
        )
        if sms_success:
            sms_sent += 1

        # Track partial / total failure
        if not (email_success and sms_success):
            failures += 1

        # Determine last_action and status
        if email_success and sms_success:
            last_action = "EMAIL+SMS_SENT"
            final_status = "DISPATCHED"
        elif email_success:
            last_action = "EMAIL_SENT"
            final_status = "DISPATCHED"
        elif sms_success:
            last_action = "SMS_SENT"
            final_status = "DISPATCHED"
        else:
            last_action = "FAILED"
            final_status = "FAILED"

        email_sent_at = now_iso_utc if email_success else candidate.get("email_sent_at")
        sms_sent_at = now_iso_utc if sms_success else candidate.get("sms_sent_at")

        history_entry = {
            "action": last_action,
            "email_status": "SENT" if email_success else "FAILED",
            "sms_status": "SENT" if sms_success else "FAILED",
            "dispatched_at": now_iso_utc,
            "email_subject": subject,
            "sms_message": sms_msg
        }

        # Update candidate in MongoDB
        if db is not None and candidate.get("_id"):
            try:
                db.recovery_candidates.update_one(
                    {"$or": [{"_id": candidate["_id"]}, {"candidate_id": cand_id}]},
                    {
                        "$set": {
                            "status": final_status,
                            "last_action": last_action,
                            "email_sent_at": email_sent_at,
                            "sms_sent_at": sms_sent_at,
                            "dispatched_at": now_iso_utc,
                            "updated_at": now_iso_utc
                        },
                        "$push": {
                            "message_history": history_entry
                        }
                    }
                )
            except Exception as err:
                logger.warning(f"[RecoveryLambda] Could not update candidate {cand_id} in MongoDB: {err}")

        # Also write audit communication log entry
        if db is not None:
            try:
                db.communication_logs.insert_one({
                    "log_id": f"log_disp_{uuid.uuid4().hex[:6]}",
                    "merchant_id": candidate.get("merchant_id", merchant_id),
                    "trace_id": trace_id,
                    "candidate_id": cand_id,
                    "email_status": "SENT" if email_success else "FAILED",
                    "sms_status": "SENT" if sms_success else "FAILED",
                    "recipient_email": cust_email,
                    "recipient_phone": cust_phone,
                    "last_action": last_action,
                    "created_at": now_iso_utc,
                    "timestamp": now_iso_utc
                })
            except Exception:
                pass

    execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # Publish CloudWatch metrics
    publish_cloudwatch_metrics(
        cw_client=cw_client,
        emails_sent=emails_sent,
        sms_sent=sms_sent,
        failures=failures,
        execution_time_ms=execution_time_ms,
        merchant_id=merchant_id
    )

    summary = {
        "status": "SUCCESS",
        "candidates_processed": candidates_processed,
        "emails_sent": emails_sent,
        "sms_sent": sms_sent,
        "failures": failures,
        "execution_time_ms": execution_time_ms,
        "campaigns_created": candidates_processed,
        "timestamp": now_iso_utc
    }

    publish_eventbridge_event(
        db=db,
        event_type="RECOVERY_CAMPAIGN_DISPATCHED",
        detail=summary,
        source="revenuepilot.recovery.lambda",
        merchant_id=merchant_id,
        trace_id=trace_id
    )

    return {
        "statusCode": 200,
        "body": json.dumps(summary)
    }
