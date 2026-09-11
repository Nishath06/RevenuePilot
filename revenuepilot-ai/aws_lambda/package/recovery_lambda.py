"""
RevenuePilot AWS Lambda — Recovery Dispatch Lambda (v4.2 Production)
====================================================================
Single Dispatch Engine: The ONLY component authorised to send SES emails and SNS SMS.
FastAPI and Recovery Intelligence Agent NEVER send recovery emails — this Lambda does.

Flow:
  EventBridge (6 PM IST daily) → RecoveryLambda → SES + SNS → MongoDB status update → CloudWatch
  Manual trigger via FastAPI → boto3 Lambda.invoke(RecoveryLambda) → same flow

Candidate filter:
  status == "SCHEDULED" AND scheduled_send_time <= now (Asia/Kolkata)

Optional payload:
  {"candidate_id": "cand_xxx", "channel": "EMAIL|SMS|EMAIL+SMS"}
"""

import os
import json
import time
import uuid
import logging
import sys
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from botocore.exceptions import ClientError

from aws_lambda.utils.aws_lambda_base import (
    get_database,
    serialize_bson,
    get_boto3_client,
    publish_eventbridge_event,
    handle_lambda_exceptions,
    log_json,
    config,
    logger,
)

# ─── Constants ────────────────────────────────────────────────────────────────

CC_EMAILS = ["jpnishath@gmail.com", "nishath2306@gmail.com"]
RETRY_DELAYS = [1, 2, 4]  # seconds — exponential backoff
IST = timezone(timedelta(hours=5, minutes=30))


# ─── Startup mode banner ──────────────────────────────────────────────────────

def _log_startup_banner() -> None:
    """Emit production mode banner on cold start / first invocation."""
    has_creds = bool(
        os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
        and os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
    )
    aws_mode = "CLOUD" if (not config.is_local_mode and has_creds) else "LOCAL"
    ses_enabled = not config.is_local_mode and has_creds
    sns_enabled = ses_enabled

    logger.info("=" * 60)
    logger.info(f"RevenuePilot AWS Mode: {aws_mode}")
    logger.info(f"SES Enabled: {ses_enabled}")
    logger.info(f"SNS Enabled: {sns_enabled}")
    logger.info(f"Local Simulation: {not ses_enabled}")
    logger.info("=" * 60)


_startup_logged = False


# ─── Environment Validation ───────────────────────────────────────────────────

REQUIRED_ENV_VARS = [
    "MONGODB_URL",
    "DATABASE_NAME",
    "AWS_REGION",
    "AWS_MODE",
    "SES_FROM_EMAIL",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
]


def validate_environment_variables() -> List[str]:
    """
    TASK 3 — Validates Lambda environment variables on startup.
    Logs missing variables individually without crashing Lambda.
    """
    missing = []
    for var_name in REQUIRED_ENV_VARS:
        val = os.environ.get(var_name, "").strip()
        if not val:
            missing.append(var_name)
            logger.warning(f"Missing required environment variable: {var_name}")
    return missing


# ─── Helpers ──────────────────────────────────────────────────────────────────

def sanitize_email(email: Optional[str]) -> str:
    if not email or not isinstance(email, str):
        return ""
    clean = email.strip().lower()
    return clean if "@" in clean and "." in clean else ""


def sanitize_phone(phone: Optional[str]) -> str:
    if not phone or not isinstance(phone, str):
        return ""
    cleaned = "".join(c for c in phone if c.isdigit() or c == "+")
    return cleaned if len(cleaned) >= 8 else ""


# ─── SES Dispatch ─────────────────────────────────────────────────────────────

def send_ses_email(
    ses_client: Any,
    sender: str,
    recipient: str,
    subject: str,
    html_body: str,
    text_body: str,
    trace_id: str,
    candidate_id: str,
    merchant_id: str,
) -> Tuple[bool, str, float, str, str]:
    """
    Sends a real SES email.
    Returns (success: bool, ses_message_id: str, latency_ms: float, error_code: str, error_message: str).
    NEVER simulates in production — raises hard failure if SES client is absent.

    Supports DEMO_EMAIL_OVERRIDE for Buildathon demo mode.
    Recipients: candidate/demo recipient + CC jpnishath@gmail.com + nishath2306@gmail.com
    Retry: 3 attempts with 1s/2s/4s exponential backoff.
    """
    aws_region = os.environ.get("AWS_REGION", "ap-south-1")
    demo_override = os.environ.get("DEMO_EMAIL_OVERRIDE", "").strip()
    actual_recipient = sanitize_email(demo_override) if demo_override else recipient

    if demo_override and actual_recipient:
        logger.info(
            json.dumps({
                "event": "demo_email_override",
                "original_recipient": recipient,
                "actual_recipient": actual_recipient,
            })
        )

    target_to = actual_recipient if (demo_override and actual_recipient) else recipient
    all_recipients = list(dict.fromkeys(
        r for r in [target_to] + CC_EMAILS if sanitize_email(r)
    ))
    if not all_recipients:
        logger.error(
            json.dumps({
                "event": "ses_dispatch_skipped",
                "reason": "no_valid_recipients",
                "trace_id": trace_id,
                "candidate_id": candidate_id,
                "merchant_id": merchant_id,
            })
        )
        return False, "", 0.0, "InvalidRecipient", "No valid recipient email address provided"

    if not ses_client:
        logger.error(
            json.dumps({
                "event": "ses_dispatch_failed",
                "reason": "ses_client_unavailable",
                "trace_id": trace_id,
                "candidate_id": candidate_id,
            })
        )
        return False, "", 0.0, "SESClientError", "SES client is unavailable"

    effective_html = html_body
    effective_text = text_body or html_body or "(no body)"

    if demo_override and actual_recipient:
        demo_banner_html = (
            f'<div style="background-color:#fff3cd;color:#856404;padding:10px;border-radius:4px;'
            f'margin-bottom:15px;font-family:sans-serif;font-size:13px;border:1px solid #ffeeba;">'
            f'<strong>[BUILDATHON DEMO MODE]</strong> Intended Recipient: <code>{recipient}</code></div>'
        )
        demo_banner_text = f"[BUILDATHON DEMO MODE] Intended Recipient: {recipient}\n" + "-" * 50 + "\n\n"
        if effective_html:
            effective_html = demo_banner_html + effective_html
        effective_text = demo_banner_text + effective_text

    body_spec: Dict[str, Any] = {}
    if effective_html:
        body_spec["Html"] = {"Data": effective_html, "Charset": "UTF-8"}
    body_spec["Text"] = {"Data": effective_text, "Charset": "UTF-8"}

    logger.info("SES email dispatch initiated.")
    logger.info(
        json.dumps({
            "event": "ses_email_dispatch_initiated",
            "sender": sender,
            "recipient": target_to,
            "original_recipient": recipient,
            "region": aws_region,
            "trace_id": trace_id,
            "candidate_id": candidate_id,
        })
    )

    last_error_code = ""
    last_error_message = ""

    for attempt, delay in enumerate(RETRY_DELAYS, start=1):
        t0 = time.perf_counter()
        try:
            resp = ses_client.send_email(
                Source=sender,
                Destination={"ToAddresses": all_recipients},
                Message={
                    "Subject": {"Data": subject or "RevenuePilot Recovery Notice", "Charset": "UTF-8"},
                    "Body": body_spec,
                },
            )
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            ses_message_id = resp.get("MessageId", "")
            logger.info(f"SES MessageId={ses_message_id}")
            logger.info(
                json.dumps({
                    "event": "ses_email_sent",
                    "ses_message_id": ses_message_id,
                    "recipient": target_to,
                    "trace_id": trace_id,
                    "candidate_id": candidate_id,
                    "latency_ms": latency_ms,
                    "attempt": attempt,
                })
            )
            return True, ses_message_id, latency_ms, "", ""

        except ClientError as e:
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            err_dict = e.response.get("Error", {}) if hasattr(e, "response") and isinstance(e.response, dict) else {}
            last_error_code = err_dict.get("Code", "ClientError")
            last_error_message = err_dict.get("Message", str(e))

            logger.error(
                json.dumps({
                    "event": "ses_email_failed",
                    "error_code": last_error_code,
                    "error_message": last_error_message,
                    "recipient": target_to,
                    "sender": sender,
                    "trace_id": trace_id,
                    "candidate_id": candidate_id,
                })
            )
            if attempt < len(RETRY_DELAYS):
                time.sleep(delay)

        except Exception as e:
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            last_error_code = type(e).__name__
            last_error_message = str(e)

            logger.error(
                json.dumps({
                    "event": "ses_email_failed",
                    "error_code": last_error_code,
                    "error_message": last_error_message,
                    "recipient": target_to,
                    "sender": sender,
                    "trace_id": trace_id,
                    "candidate_id": candidate_id,
                })
            )
            if attempt < len(RETRY_DELAYS):
                time.sleep(delay)

    return False, "", 0.0, last_error_code, last_error_message


# ─── SNS Dispatch ─────────────────────────────────────────────────────────────

def send_sns_sms(
    sns_client: Any,
    phone: str,
    message: str,
    trace_id: str,
    candidate_id: str,
    merchant_id: str,
) -> Tuple[bool, str, float]:
    """
    Sends a real SNS SMS.
    Returns (success: bool, sns_message_id: str, latency_ms: float).
    Retry: 3 attempts with 1s/2s/4s backoff.
    """
    if not phone or len(phone) < 8:
        logger.warning(
            json.dumps({
                "event": "sns_dispatch_skipped",
                "reason": "invalid_phone",
                "trace_id": trace_id,
                "candidate_id": candidate_id,
            })
        )
        return False, "", 0.0

    if not sns_client:
        logger.error(
            json.dumps({
                "event": "sns_dispatch_failed",
                "reason": "sns_client_unavailable",
                "trace_id": trace_id,
                "candidate_id": candidate_id,
            })
        )
        return False, "", 0.0

    for attempt, delay in enumerate(RETRY_DELAYS, start=1):
        t0 = time.perf_counter()
        try:
            resp = sns_client.publish(
                PhoneNumber=phone,
                Message=message,
            )
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            sns_message_id = resp.get("MessageId", "")
            logger.info(
                json.dumps({
                    "event": "sns_sms_sent",
                    "trace_id": trace_id,
                    "candidate_id": candidate_id,
                    "merchant_id": merchant_id,
                    "phone": phone,
                    "sns_message_id": sns_message_id,
                    "latency_ms": latency_ms,
                    "attempt": attempt,
                })
            )
            return True, sns_message_id, latency_ms

        except Exception as err:
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            logger.warning(
                json.dumps({
                    "event": "sns_attempt_failed",
                    "attempt": attempt,
                    "trace_id": trace_id,
                    "candidate_id": candidate_id,
                    "error": str(err),
                    "latency_ms": latency_ms,
                })
            )
            if attempt < len(RETRY_DELAYS):
                time.sleep(delay)

    return False, "", 0.0


# ─── CloudWatch Metrics ───────────────────────────────────────────────────────

def publish_cloudwatch_metrics(
    cw_client: Any,
    emails_sent: int,
    sms_sent: int,
    failures: int,
    execution_time_ms: float,
    candidates_processed: int = 0,
    merchant_id: str = "merch_default",
    trace_id: str = "",
) -> None:
    """
    TASK 7 — Publishes metrics to RevenuePilot/AutoOps namespace.
    Metrics: EmailsSent, SMSSent, DispatchFailures, DispatchDuration, CandidatesProcessed.
    """
    namespace = os.environ.get("CLOUDWATCH_NAMESPACE", "RevenuePilot/AutoOps")
    dims = [
        {"Name": "MerchantID", "Value": merchant_id or "merch_default"},
        {"Name": "Environment", "Value": os.environ.get("ENVIRONMENT", "production")},
    ]
    metric_items = [
        {"MetricName": "EmailsSent", "Value": float(emails_sent), "Unit": "Count"},
        {"MetricName": "SMSSent", "Value": float(sms_sent), "Unit": "Count"},
        {"MetricName": "DispatchFailures", "Value": float(failures), "Unit": "Count"},
        {"MetricName": "DispatchDuration", "Value": float(execution_time_ms), "Unit": "Milliseconds"},
        {"MetricName": "CandidatesProcessed", "Value": float(candidates_processed), "Unit": "Count"},
    ]

    if cw_client:
        try:
            cw_client.put_metric_data(
                Namespace=namespace,
                MetricData=[
                    {"MetricName": m["MetricName"], "Value": m["Value"], "Unit": m["Unit"], "Dimensions": dims}
                    for m in metric_items
                ],
            )
            logger.info("CloudWatch metrics published successfully to RevenuePilot/AutoOps.")
            logger.info(
                json.dumps({
                    "event": "cloudwatch_metrics_published",
                    "namespace": namespace,
                    "metrics": {m["MetricName"]: m["Value"] for m in metric_items},
                    "trace_id": trace_id,
                    "merchant_id": merchant_id,
                })
            )
        except Exception as err:
            logger.warning(f"[RecoveryLambda] CloudWatch publish failed: {err}")
    else:
        logger.info(
            json.dumps({
                "event": "cloudwatch_metrics_local",
                "namespace": namespace,
                "metrics": {m["MetricName"]: m["Value"] for m in metric_items},
                "trace_id": trace_id,
            })
        )


# ─── Single Candidate Dispatch ────────────────────────────────────────────────

def dispatch_candidate(
    candidate: Dict[str, Any],
    ses_client: Any,
    sns_client: Any,
    sender_email: str,
    trace_id: str,
    channel: str,
    db: Any,
    now_ist: datetime,
    now_utc: datetime,
    campaign_run_id: str,
) -> Dict[str, Any]:
    """
    Dispatches email and/or SMS for a single candidate.
    Updates MongoDB after success. Never loses candidate history.
    Returns a result dict with outcome details.
    """
    cand_id = candidate.get("candidate_id") or str(candidate.get("_id", ""))
    merchant_id = candidate.get("merchant_id", "merch_default")
    cust_email = sanitize_email(candidate.get("customer_email") or candidate.get("email", ""))
    cust_phone = sanitize_phone(candidate.get("customer_phone") or candidate.get("phone", ""))
    cust_name = candidate.get("customer_name") or candidate.get("name") or "Valued Customer"

    subject = candidate.get("email_subject") or "Complete your transaction — exclusive offer inside"
    html_body = candidate.get("email_body_html") or f"<p>Hi {cust_name}, complete your order today!</p>"
    text_body = candidate.get("email_body_text") or f"Hi {cust_name}, complete your order today!"
    sms_msg = candidate.get("sms_message") or candidate.get("whatsapp_message") or "RevenuePilot: Complete your order today!"

    now_iso_utc = now_utc.isoformat()
    now_iso_ist = now_ist.isoformat()

    # Determine what channels to send
    do_email = channel in {"EMAIL", "EMAIL+SMS", "BOTH", "ALL", ""}
    do_sms = channel in {"SMS", "EMAIL+SMS", "BOTH", "ALL", ""}

    email_success, ses_message_id, email_latency = False, "", 0.0
    ses_error_code, ses_error_message = "", ""
    sms_success, sns_message_id, sms_latency = False, "", 0.0

    # ── Email dispatch ─────────────────────────────────────────────────────────
    if do_email and cust_email:
        email_success, ses_message_id, email_latency, ses_error_code, ses_error_message = send_ses_email(
            ses_client=ses_client,
            sender=sender_email,
            recipient=cust_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            trace_id=trace_id,
            candidate_id=cand_id,
            merchant_id=merchant_id,
        )
    elif do_email and not cust_email:
        logger.warning(json.dumps({
            "event": "email_skipped_no_address",
            "candidate_id": cand_id,
            "trace_id": trace_id,
        }))

    # ── SMS dispatch ───────────────────────────────────────────────────────────
    if do_sms and cust_phone:
        sms_success, sns_message_id, sms_latency = send_sns_sms(
            sns_client=sns_client,
            phone=cust_phone,
            message=sms_msg,
            trace_id=trace_id,
            candidate_id=cand_id,
            merchant_id=merchant_id,
        )
    elif do_sms and not cust_phone:
        logger.warning(json.dumps({
            "event": "sms_skipped_no_phone",
            "candidate_id": cand_id,
            "trace_id": trace_id,
        }))

    # ── Determine final status ─────────────────────────────────────────────────
    if email_success and sms_success:
        final_status = "DISPATCHED"
        last_action = "EMAIL+SMS_SENT"
        dispatch_metadata_email_sent = True
        dispatch_metadata_sms_sent = True
    elif email_success:
        final_status = "EMAIL_SENT"
        last_action = "EMAIL_SENT"
        dispatch_metadata_email_sent = True
        dispatch_metadata_sms_sent = False
    elif sms_success:
        final_status = "DISPATCHED"
        last_action = "SMS_SENT"
        dispatch_metadata_email_sent = False
        dispatch_metadata_sms_sent = True
    else:
        final_status = "FAILED"
        last_action = "EMAIL_FAILED" if do_email else "SMS_FAILED"
        dispatch_metadata_email_sent = False
        dispatch_metadata_sms_sent = False

    history_entry: Dict[str, Any] = {
        "action": last_action,
        "email_status": "SENT" if email_success else ("SKIPPED" if not do_email else "FAILED"),
        "sms_status": "SENT" if sms_success else ("SKIPPED" if not do_sms else "FAILED"),
        "dispatched_at": now_iso_utc,
        "dispatched_at_ist": now_iso_ist,
        "email_subject": subject if do_email else None,
        "sms_message": sms_msg if do_sms else None,
        "ses_message_id": ses_message_id,
        "sns_message_id": sns_message_id,
        "trace_id": trace_id,
        "campaign_run_id": campaign_run_id,
        "channel": channel or "EMAIL+SMS",
    }
    if do_email and not email_success:
        history_entry["error_code"] = ses_error_code
        history_entry["error_message"] = ses_error_message

    # ── MongoDB update ────────────────────────────────────────────────────────
    if db is not None and candidate.get("_id"):
        try:
            set_doc: Dict[str, Any] = {
                "status": final_status,
                "recovery_status": final_status,
                "last_action": last_action,
                "dispatched_at": now_iso_utc,
                "updated_at": now_iso_utc,
                "dispatch_metadata.email_sent": dispatch_metadata_email_sent,
                "dispatch_metadata.sms_sent": dispatch_metadata_sms_sent,
                "dispatch_metadata.dispatch_time": now_iso_ist,
                "dispatch_metadata.campaign_run_id": campaign_run_id,
                "dispatch_metadata.ses_message_id": ses_message_id,
                "dispatch_metadata.sns_message_id": sns_message_id,
            }
            if email_success:
                set_doc["email_sent_at"] = now_iso_utc
            if sms_success:
                set_doc["sms_sent_at"] = now_iso_utc

            if do_email and not email_success:
                set_doc["dispatch_metadata.email_error"] = ses_error_message or "SES delivery failed"
                set_doc["dispatch_metadata.error_code"] = ses_error_code
                set_doc["dispatch_metadata.error_message"] = ses_error_message

            db.recovery_candidates.update_one(
                {"$or": [{"_id": candidate["_id"]}, {"candidate_id": cand_id}]},
                {
                    "$set": set_doc,
                    "$push": {"message_history": history_entry},
                },
            )
            if email_success:
                logger.info("Candidate status updated EMAIL_SENT.")
        except Exception as err:
            logger.warning(f"[RecoveryLambda] MongoDB update failed for {cand_id}: {err}")

    # Communication log entry
    if db is not None:
        try:
            db.communication_logs.insert_one({
                "log_id": f"log_disp_{uuid.uuid4().hex[:8]}",
                "merchant_id": merchant_id,
                "trace_id": trace_id,
                "candidate_id": cand_id,
                "customer_email": cust_email,
                "customer_phone": cust_phone,
                "channel": channel or "EMAIL+SMS",
                "email_status": "SENT" if email_success else "FAILED",
                "sms_status": "SENT" if sms_success else "FAILED",
                "ses_message_id": ses_message_id,
                "sns_message_id": sns_message_id,
                "last_action": last_action,
                "latency_ms": round(email_latency + sms_latency, 2),
                "status": final_status,
                "created_at": now_iso_utc,
                "timestamp": now_iso_utc,
            })
        except Exception:
            pass

    return {
        "candidate_id": cand_id,
        "status": final_status,
        "last_action": last_action,
        "channel": channel or "EMAIL+SMS",
        "email_success": email_success,
        "sms_success": sms_success,
        "ses_message_id": ses_message_id,
        "sns_message_id": sns_message_id,
        "trace_id": trace_id,
        "latency_ms": round(email_latency + sms_latency, 2),
    }


# ─── Lambda Handler ───────────────────────────────────────────────────────────

@handle_lambda_exceptions("RecoveryLambda")
def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    AWS Recovery Dispatch Lambda — Single Dispatch Engine entry point.

    Trigger modes:
      1. EventBridge (6 PM IST daily) — no payload, dispatches all SCHEDULED candidates.
      2. Manual invoke via FastAPI boto3 — payload: {"candidate_id": "cand_xxx", "channel": "EMAIL|SMS|EMAIL+SMS"}

    Uses real SES + SNS. No local simulation for recovery dispatches.
    """
    global _startup_logged
    if not _startup_logged:
        _log_startup_banner()
        _startup_logged = True

    start_time = time.perf_counter()

    # TASK 3 — Validate environment variables
    validate_environment_variables()

    db = get_database()
    cw_client = get_boto3_client("cloudwatch")
    event = event if isinstance(event, dict) else {}
    merchant_id = event.get("merchant_id", "merch_default")
    trace_id = event.get("trace_id") or (
        getattr(context, "aws_request_id", None) if context else None
    ) or f"trace_{uuid.uuid4().hex[:10]}"

    if db is None:
        logger.error("Failed to connect to MongoDB.")
        publish_cloudwatch_metrics(
            cw_client=cw_client,
            emails_sent=0,
            sms_sent=0,
            failures=1,
            execution_time_ms=round((time.perf_counter() - start_time) * 1000, 2),
            candidates_processed=0,
            merchant_id=merchant_id,
            trace_id=trace_id,
        )
        return {
            "statusCode": 500,
            "body": json.dumps({"status": "FAILED", "error": "MongoDB connection failed"}),
        }

    # ── Extract invocation metadata ────────────────────────────────────────────
    campaign_run_id = (
        getattr(context, "aws_request_id", None) if context else None
    ) or f"run_{uuid.uuid4().hex[:8]}"
    channel = event.get("channel", "EMAIL+SMS").upper()

    # ── Time references ────────────────────────────────────────────────────────
    now_utc = datetime.now(timezone.utc)
    now_ist = datetime.now(IST)
    now_iso_utc = now_utc.isoformat()
    now_iso_ist = now_ist.isoformat()

    # ── AWS Clients (real cloud only) ──────────────────────────────────────────
    ses_client = get_boto3_client("ses")
    sns_client = get_boto3_client("sns")

    sender_email = (
        os.environ.get("SES_FROM_EMAIL")
        or os.environ.get("SES_SENDER_EMAIL")
        or "noreply@revenuepilot.ai"
    )

    # ── TASK 4 — Fetch candidate(s) ───────────────────────────────────────────
    candidate_docs: List[Dict[str, Any]] = []
    specific_candidate_id = event.get("candidate_id")

    try:
        if specific_candidate_id:
            # Single-candidate manual dispatch
            doc = db.recovery_candidates.find_one({
                "$or": [
                    {"candidate_id": specific_candidate_id},
                    {"_id": specific_candidate_id},
                ]
            })
            if doc:
                candidate_docs = [doc]
            else:
                logger.error(json.dumps({
                    "event": "candidate_not_found",
                    "candidate_id": specific_candidate_id,
                    "trace_id": trace_id,
                }))
        else:
            # Batch: all SCHEDULED/APPROVED candidates ready for dispatch
            cand_filter: Dict[str, Any] = {
                "status": {"$in": ["SCHEDULED", "scheduled", "APPROVED"]},
                "recovery_status": {"$nin": ["DISPATCHED", "EMAIL_SENT", "SMS_SENT", "EMAIL+SMS_SENT", "FAILED", "SKIPPED", "RECOVERED"]},
            }
            if merchant_id and merchant_id != "all":
                cand_filter["merchant_id"] = merchant_id

            cursor = db.recovery_candidates.find(cand_filter).limit(200)
            candidate_docs = list(cursor)

    except Exception as err:
        logger.error(f"[RecoveryLambda] MongoDB query failed: {err}")

    if not candidate_docs:
        logger.info("No eligible recovery candidates found.")
        execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        publish_cloudwatch_metrics(
            cw_client=cw_client,
            emails_sent=0,
            sms_sent=0,
            failures=0,
            execution_time_ms=execution_time_ms,
            candidates_processed=0,
            merchant_id=merchant_id,
            trace_id=trace_id,
        )
        return {
            "statusCode": 200,
            "body": json.dumps({
                "status": "SUCCESS",
                "message": "No eligible recovery candidates found.",
                "candidates_processed": 0,
                "emails_sent": 0,
                "execution_time_ms": execution_time_ms,
            }),
        }

    logger.info(f"Fetched {len(candidate_docs)} scheduled candidates.")

    # ── Dispatch loop ──────────────────────────────────────────────────────────
    emails_sent = 0
    sms_sent = 0
    failures = 0
    results = []

    for candidate in candidate_docs:
        result = dispatch_candidate(
            candidate=candidate,
            ses_client=ses_client,
            sns_client=sns_client,
            sender_email=sender_email,
            trace_id=trace_id,
            channel=channel,
            db=db,
            now_ist=now_ist,
            now_utc=now_utc,
            campaign_run_id=campaign_run_id,
        )
        results.append(result)

        if result["email_success"]:
            emails_sent += 1
        if result["sms_success"]:
            sms_sent += 1
        if result["status"] == "FAILED":
            failures += 1

    execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    # ── CloudWatch metrics ─────────────────────────────────────────────────────
    publish_cloudwatch_metrics(
        cw_client=cw_client,
        emails_sent=emails_sent,
        sms_sent=sms_sent,
        failures=failures,
        execution_time_ms=execution_time_ms,
        candidates_processed=len(candidate_docs),
        merchant_id=merchant_id,
        trace_id=trace_id,
    )

    # ── Summary ────────────────────────────────────────────────────────────────
    summary = {
        "status": "SUCCESS",
        "trace_id": trace_id,
        "campaign_run_id": campaign_run_id,
        "merchant_id": merchant_id,
        "candidates_processed": len(candidate_docs),
        "emails_sent": emails_sent,
        "sms_sent": sms_sent,
        "failures": failures,
        "execution_time_ms": execution_time_ms,
        "dispatched_at_ist": now_iso_ist,
        "dispatched_at_utc": now_iso_utc,
        "results": results,
    }

    logger.info("Dispatch completed successfully.")
    logger.info(json.dumps({
        "event": "dispatch_completed",
        **{k: v for k, v in summary.items() if k != "results"},
    }))

    # ── EventBridge notification ───────────────────────────────────────────────
    publish_eventbridge_event(
        db=db,
        event_type="RECOVERY_CAMPAIGN_DISPATCHED",
        detail={k: v for k, v in summary.items() if k != "results"},
        source="revenuepilot.recovery.lambda",
        merchant_id=merchant_id,
        trace_id=trace_id,
    )

    return {
        "statusCode": 200,
        "body": json.dumps(serialize_bson(summary)),
    }
