"""
RevenuePilot AWS Lambda — RecoveryLambda (v3.0 Refactored)
Automates failed payment and cancelled order recovery campaigns, generates dynamic coupons,
dispatches multi-channel messages (AWS SES Email, AWS SNS SMS, WhatsApp previews), and writes
audit logs & campaigns into MongoDB Atlas with 48-hour deduplication.
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
    return cleaned if len(cleaned) >= 10 else ""


def generate_recovery_coupon(scenario: str, amount: float) -> Dict[str, Any]:
    """Generates dynamic recovery discount coupon based on cart amount."""
    discount_pct = 15 if amount > 5000 else 10
    prefix = "RECOVER" if "FAIL" in scenario.upper() or "PAYMENT" in scenario.upper() else "COMEBACK"
    code = f"{prefix}{discount_pct}_{uuid.uuid4().hex[:4].upper()}"
    return {
        "coupon_code": code,
        "discount_percentage": discount_pct,
        "valid_hours": 48
    }


@handle_lambda_exceptions("RecoveryLambda")
def lambda_handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    AWS Lambda entry point for Recovery Campaign Orchestration.
    Reads pending recovery candidates from MongoDB Atlas `recovery_candidates` collection or payload event,
    skips duplicates within 48h and expired candidates, dispatches SES email & SNS SMS with retries,
    updates candidate status (PENDING, SENT, FAILED, SKIPPED), and records communications & audit logs.
    """
    db = get_database()
    merchant_id = event.get("merchant_id", "merch_default") if isinstance(event, dict) else "merch_default"
    trace_id = event.get("trace_id") if isinstance(event, dict) else None
    if not trace_id and context and hasattr(context, "aws_request_id"):
        trace_id = context.aws_request_id

    event_type = event.get("event_type", "PAYMENT_FAILED") if isinstance(event, dict) else "PAYMENT_FAILED"

    # Targets to process
    targets: List[Dict[str, Any]] = []

    # 1. Direct payload target if provided
    if isinstance(event, dict) and (event.get("customer_email") or event.get("order_id")):
        targets.append({
            "candidate_id": event.get("candidate_id", f"cand_{uuid.uuid4().hex[:8]}"),
            "order_id": event.get("order_id", f"ord_rec_{uuid.uuid4().hex[:6]}"),
            "customer_name": event.get("customer_name", "Valued Customer"),
            "customer_email": sanitize_email(event.get("customer_email")),
            "customer_phone": sanitize_phone(event.get("customer_phone")),
            "amount": float(event.get("amount") or 2999.0),
            "event_type": event_type,
            "merchant_id": merchant_id,
            "expires_at": event.get("expires_at")
        })
    elif db is not None:
        try:
            # Query pending recovery_candidates from MongoDB Atlas with merchant filtering
            cand_query: Dict[str, Any] = {"status": {"$in": ["PENDING", "pending"]}}
            if merchant_id and merchant_id != "all":
                cand_query["merchant_id"] = merchant_id

            cursor = db.recovery_candidates.find(cand_query).limit(50)
            pending_docs = list(cursor)

            for doc in pending_docs:
                clean_doc = serialize_bson(doc)
                targets.append({
                    "candidate_id": clean_doc.get("candidate_id") or str(doc.get("_id")),
                    "order_id": clean_doc.get("order_id", f"ord_{uuid.uuid4().hex[:6]}"),
                    "customer_name": clean_doc.get("customer_name", "Customer"),
                    "customer_email": sanitize_email(clean_doc.get("customer_email")),
                    "customer_phone": sanitize_phone(clean_doc.get("customer_phone")),
                    "amount": float(clean_doc.get("amount") or 1999.0),
                    "event_type": clean_doc.get("event_type", "PAYMENT_FAILED"),
                    "merchant_id": clean_doc.get("merchant_id", merchant_id),
                    "expires_at": clean_doc.get("expires_at"),
                    "mongo_id": doc.get("_id")
                })
        except Exception as err:
            logger.warning(f"[RecoveryLambda] MongoDB recovery_candidates fetch fallback: {err}")

        # Fallback to failed payments collection if no recovery_candidates found
        if not targets:
            try:
                cutoff_dt = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
                pay_query: Dict[str, Any] = {
                    "status": {"$in": ["failed", "FAILED", "cancelled", "CANCELLED"]},
                    "created_at": {"$gte": cutoff_dt}
                }
                if merchant_id and merchant_id != "all":
                    pay_query["merchant_id"] = merchant_id

                cursor = db.payments.find(pay_query, {"_id": 0}).limit(50)
                failed_payments = list(cursor)

                for p in failed_payments:
                    targets.append({
                        "candidate_id": f"cand_{uuid.uuid4().hex[:8]}",
                        "order_id": p.get("order_id", f"ord_{uuid.uuid4().hex[:6]}"),
                        "customer_name": p.get("customer_name", "Customer"),
                        "customer_email": sanitize_email(p.get("customer_email")),
                        "customer_phone": sanitize_phone(p.get("customer_phone")),
                        "amount": float(p.get("amount") or 1999.0),
                        "event_type": "PAYMENT_FAILED" if "fail" in str(p.get("status")).lower() else "ORDER_CANCELLED",
                        "merchant_id": p.get("merchant_id", merchant_id),
                        "expires_at": None
                    })
            except Exception as err:
                logger.warning(f"[RecoveryLambda] MongoDB payments query fallback: {err}")

    # Fallback target if empty
    if not targets:
        targets.append({
            "candidate_id": f"cand_demo_{uuid.uuid4().hex[:6]}",
            "order_id": f"ord_demo_{uuid.uuid4().hex[:6]}",
            "customer_name": "Rohan Sharma",
            "customer_email": "rohan@example.com",
            "customer_phone": "+919876543210",
            "amount": 4999.0,
            "event_type": event_type,
            "merchant_id": merchant_id,
            "expires_at": None
        })

    emails_sent = 0
    sms_sent = 0
    campaigns_created = 0
    deduped_count = 0
    skipped_expired_count = 0
    failed_count = 0

    ses_client = get_boto3_client("ses")
    sns_client = get_boto3_client("sns")

    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()
    dedupe_cutoff = (now_dt - timedelta(hours=48)).isoformat()

    # Process targets
    for target in targets:
        c_id = target.get("candidate_id")
        c_email = target["customer_email"]
        c_phone = target["customer_phone"]
        c_name = target["customer_name"]
        o_id = target["order_id"]
        amt = target["amount"]
        evt = target["event_type"]
        t_merchant = target.get("merchant_id", merchant_id)
        exp_at = target.get("expires_at")

        # 1. Expiration check
        if exp_at and exp_at < now_iso:
            skipped_expired_count += 1
            logger.info(f"[RecoveryLambda] Candidate {c_id} expired at {exp_at}. Status -> SKIPPED")
            if db is not None and c_id:
                try:
                    db.recovery_candidates.update_one(
                        {"$or": [{"candidate_id": c_id}, {"_id": target.get("mongo_id")}]},
                        {"$set": {"status": "SKIPPED", "skip_reason": "EXPIRED", "updated_at": now_iso}}
                    )
                except Exception:
                    pass
            continue

        # 2. Deduplication check in MongoDB (skip if recovery campaign created for same email/order in last 48h)
        if db is not None and (c_email or o_id):
            try:
                recent_query: Dict[str, Any] = {
                    "$or": [k for k in [{"customer_email": c_email}, {"order_id": o_id}] if k.values()],
                    "created_at": {"$gte": dedupe_cutoff}
                }
                if t_merchant and t_merchant != "all":
                    recent_query["merchant_id"] = t_merchant

                recent = db.recovery_campaigns.find_one(recent_query)
                if recent:
                    deduped_count += 1
                    logger.info(f"[RecoveryLambda] Skipping duplicate recovery for {c_email} / {o_id}")
                    if c_id:
                        db.recovery_candidates.update_one(
                            {"$or": [{"candidate_id": c_id}, {"_id": target.get("mongo_id")}]},
                            {"$set": {"status": "SKIPPED", "skip_reason": "DUPLICATE_48H", "updated_at": now_iso}}
                        )
                    continue
            except Exception as err:
                logger.warning(f"[RecoveryLambda] Dedupe query exception: {err}")

        coupon = generate_recovery_coupon(evt, amt)
        campaign_id = f"cmp_{uuid.uuid4().hex[:10]}"

        # Templates
        email_subject = f"Complete your purchase with {coupon['discount_percentage']}% OFF!"
        email_body = (
            f"Hi {c_name},\n\n"
            f"We noticed your payment attempt of ₹{amt:,.2f} could not be completed.\n"
            f"Use code {coupon['coupon_code']} at checkout for {coupon['discount_percentage']}% OFF!\n\n"
            f"Complete purchase: https://store.revenuepilot.ai/checkout?recovery={campaign_id}\n\n"
            f"Best regards,\nRevenuePilot Autonomous Team"
        )
        whatsapp_copy = (
            f"Hey {c_name}! 🚀 We saved your cart worth ₹{amt:,.2f}. "
            f"Use code *{coupon['coupon_code']}* for {coupon['discount_percentage']}% OFF today only!"
        )

        # Dispatch Email (SES with 2 retries or Local Sim)
        email_success = False
        if config.is_local_mode or not ses_client:
            email_success = True
            emails_sent += 1
            if db is not None:
                try:
                    db.communication_logs.insert_one({
                        "log_id": f"log_email_{uuid.uuid4().hex[:6]}",
                        "merchant_id": t_merchant,
                        "trace_id": trace_id,
                        "candidate_id": c_id,
                        "channel": "SES_EMAIL",
                        "recipient": c_email or "simulated@example.com",
                        "subject": email_subject,
                        "body": email_body,
                        "status": "SIMULATED_SUCCESS",
                        "created_at": now_iso,
                        "timestamp": now_iso
                    })
                except Exception:
                    pass
        else:
            if c_email and config.ses_sender_email:
                for attempt in range(1, 3):
                    try:
                        ses_client.send_email(
                            Source=config.ses_sender_email,
                            Destination={'ToAddresses': [c_email]},
                            Message={
                                'Subject': {'Data': email_subject},
                                'Body': {'Text': {'Data': email_body}}
                            }
                        )
                        email_success = True
                        emails_sent += 1
                        break
                    except Exception as err:
                        logger.warning(f"[RecoveryLambda] SES attempt {attempt} failed for {c_email}: {err}")

        # Dispatch SMS (SNS with 2 retries or Local Sim)
        sms_success = False
        if config.is_local_mode or not sns_client:
            sms_success = True
            sms_sent += 1
            if db is not None:
                try:
                    db.communication_logs.insert_one({
                        "log_id": f"log_sms_{uuid.uuid4().hex[:6]}",
                        "merchant_id": t_merchant,
                        "trace_id": trace_id,
                        "candidate_id": c_id,
                        "channel": "SNS_SMS",
                        "recipient": c_phone or "+919876543210",
                        "message": f"RevenuePilot: Code {coupon['coupon_code']} for {coupon['discount_percentage']}% OFF!",
                        "status": "SIMULATED_SUCCESS",
                        "created_at": now_iso,
                        "timestamp": now_iso
                    })
                except Exception:
                    pass
        else:
            if c_phone:
                for attempt in range(1, 3):
                    try:
                        sns_client.publish(
                            PhoneNumber=c_phone,
                            Message=f"RevenuePilot: Code {coupon['coupon_code']} for {coupon['discount_percentage']}% OFF!"
                        )
                        sms_success = True
                        sms_sent += 1
                        break
                    except Exception as err:
                        logger.warning(f"[RecoveryLambda] SNS attempt {attempt} failed for {c_phone}: {err}")

        overall_status = "SENT" if (email_success or sms_success) else "FAILED"
        if overall_status == "FAILED":
            failed_count += 1

        # Persist Campaign Document
        campaign_doc = {
            "campaign_id": campaign_id,
            "candidate_id": c_id,
            "merchant_id": t_merchant,
            "order_id": o_id,
            "customer_name": c_name,
            "customer_email": c_email,
            "customer_phone": c_phone,
            "amount": amt,
            "discount_code": coupon["coupon_code"],
            "coupon": coupon,
            "channel": "WhatsApp + Email + SMS",
            "title": f"Recovery Offer ({coupon['discount_percentage']}% OFF)",
            "status": overall_status,
            "email_sent": email_success,
            "sms_sent": sms_success,
            "whatsapp_preview": whatsapp_copy,
            "created_at": now_iso,
            "timestamp": now_iso
        }
        campaigns_created += 1

        if db is not None:
            try:
                db.recovery_campaigns.insert_one(campaign_doc)
                # Update candidate status in recovery_candidates collection
                if c_id:
                    db.recovery_candidates.update_one(
                        {"$or": [{"candidate_id": c_id}, {"_id": target.get("mongo_id")}]},
                        {"$set": {
                            "status": overall_status,
                            "campaign_id": campaign_id,
                            "updated_at": now_iso,
                            "dispatched_at": now_iso
                        }}
                    )
            except Exception as err:
                logger.warning(f"[RecoveryLambda] Failed to insert campaign/update candidate in Mongo: {err}")

    execution_result = {
        "status": "SUCCESS",
        "function_name": "RecoveryLambda",
        "merchant_id": merchant_id,
        "trace_id": trace_id,
        "emails_sent": emails_sent,
        "sms_sent": sms_sent,
        "campaigns_created": campaigns_created,
        "deduped_count": deduped_count,
        "skipped_expired": skipped_expired_count,
        "failed_count": failed_count,
        "timestamp": now_iso
    }

    # Emit EventBridge event
    publish_eventbridge_event(
        db=db,
        event_type="RECOVERY_CAMPAIGN_DISPATCHED",
        detail=execution_result,
        source="revenuepilot.recovery.lambda",
        merchant_id=merchant_id,
        trace_id=trace_id
    )

    return {
        "statusCode": 200,
        "body": json.dumps(execution_result)
    }
