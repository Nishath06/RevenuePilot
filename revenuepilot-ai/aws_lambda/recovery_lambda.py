"""
RevenuePilot AWS Lambda — RecoveryLambda
Automates failed payment and cancelled order recovery campaigns.
Triggered by: AWS EventBridge events (e.g. PAYMENT_FAILED, ORDER_CANCELLED) or Cron Scheduler.
Integration: AWS SES for Email, AWS SNS for SMS, EventBridge for workflow tracking.
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
ses_client = boto3.client('ses')
eventbridge_client = boto3.client('events')

EVENT_BUS_NAME = os.environ.get("EVENTBRIDGE_BUS_NAME", "revenuepilot-event-bus")
SENDER_EMAIL = os.environ.get("SES_SENDER_EMAIL", "noreply@revenuepilot.ai")


def generate_coupon(scenario: str, amount: float) -> dict:
    """Generates dynamic recovery discount coupon based on cart value."""
    discount_pct = 15 if amount > 5000 else 10
    code = f"RECOVER{discount_pct}" if scenario == "PAYMENT_FAILED" else f"COMEBACK{discount_pct}"
    return {
        "coupon_code": code,
        "discount_percentage": discount_pct,
        "valid_hours": 48
    }


def lambda_handler(event, context):
    """
    AWS Lambda entry point for Recovery Campaign Orchestration.
    """
    logger.info(f"RecoveryLambda invoked with event: {json.dumps(event)}")
    
    event_type = event.get("event_type", "PAYMENT_FAILED")
    customer_name = event.get("customer_name", "Valued Customer")
    customer_email = event.get("customer_email", "customer@example.com")
    customer_phone = event.get("customer_phone", "+919876543210")
    amount = float(event.get("amount", 2999))
    merchant_id = event.get("merchant_id", "merch_default")
    trace_id = event.get("trace_id", context.aws_request_id if context else f"rec_{uuid.uuid4().hex[:8]}")

    coupon = generate_coupon(event_type, amount)
    campaign_id = f"cmp_{uuid.uuid4().hex[:10]}"

    # Message Template Rendering
    email_subject = f"Complete your purchase with {coupon['discount_percentage']}% OFF!"
    email_body = (
        f"Hi {customer_name},\n\n"
        f"We noticed your recent payment attempt of ₹{amount:,.2f} could not be completed.\n"
        f"Use code {coupon['coupon_code']} at checkout for {coupon['discount_percentage']}% OFF!\n\n"
        f"Link to complete: https://store.revenuepilot.ai/checkout?recovery={campaign_id}\n\n"
        f"Best regards,\nRevenuePilot Autonomous Team"
    )

    whatsapp_copy = (
        f"Hey {customer_name}! 🚀 We saved your cart worth ₹{amount:,.2f}. "
        f"Use code *{coupon['coupon_code']}* for {coupon['discount_percentage']}% OFF today only! "
        f"Complete order: https://store.revenuepilot.ai/checkout?recovery={campaign_id}"
    )

    # Dispatch AWS SES Email if configured
    email_sent = False
    try:
        if SENDER_EMAIL and customer_email:
            ses_client.send_email(
                Source=SENDER_EMAIL,
                Destination={'ToAddresses': [customer_email]},
                Message={
                    'Subject': {'Data': email_subject},
                    'Body': {'Text': {'Data': email_body}}
                }
            )
            email_sent = True
            logger.info(f"SES recovery email dispatched to {customer_email}")
    except Exception as err:
        logger.warning(f"SES email delivery skipped/failed: {str(err)}")

    # Dispatch AWS SNS SMS if configured
    sms_sent = False
    try:
        if customer_phone:
            sns_client.publish(
                PhoneNumber=customer_phone,
                Message=f"RevenuePilot: Complete your order with code {coupon['coupon_code']} for {coupon['discount_percentage']}% OFF!"
            )
            sms_sent = True
            logger.info(f"SNS recovery SMS dispatched to {customer_phone}")
    except Exception as err:
        logger.warning(f"SNS SMS delivery skipped/failed: {str(err)}")

    result = {
        "status": "SUCCESS",
        "campaign_id": campaign_id,
        "function_name": "RecoveryLambda",
        "event_type": event_type,
        "merchant_id": merchant_id,
        "trace_id": trace_id,
        "customer": {"name": customer_name, "email": customer_email, "phone": customer_phone},
        "coupon": coupon,
        "channels": {
            "email_sent": email_sent,
            "sms_sent": sms_sent,
            "whatsapp_preview": whatsapp_copy,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Emit event to EventBridge
    try:
        eventbridge_client.put_events(
            Entries=[{
                'Source': 'revenuepilot.recovery.lambda',
                'DetailType': 'RECOVERY_CAMPAIGN_DISPATCHED',
                'Detail': json.dumps(result),
                'EventBusName': EVENT_BUS_NAME
            }]
        )
    except Exception as err:
        logger.warning(f"EventBridge publish fallback: {str(err)}")

    return {
        "statusCode": 200,
        "body": json.dumps(result)
    }
