"""
RevenuePilot v4.0 — Recovery Prompt Builder
============================================
Builds structured JSON prompts for the LLM Recovery Decision Engine.
Keeps all prompt logic isolated from the agent and scoring modules.
"""
from __future__ import annotations

import json
from typing import Any, Dict

from app.services.recovery_scoring import CustomerFeatures


# ── Prompt Version ─────────────────────────────────────────────────────────────
PROMPT_VERSION = "v4.0"


def build_recovery_prompt(
    features: CustomerFeatures,
    segment: str,
    merchant_metrics: Dict[str, Any],
) -> str:
    """
    Builds the full LLM recovery decision prompt.
    Input is structured customer + merchant context JSON.
    Output instruction requests a strict JSON response.
    """
    customer_profile = {
        "customer_id": features.customer_id,
        "segment": segment,
        "lifetime_value": features.lifetime_value,
        "average_order_value": features.average_order_value,
        "total_successful_orders": features.total_successful_orders,
        "total_failed_payments": features.total_failed_payments,
        "total_cancelled_orders": features.total_cancelled_orders,
        "total_abandoned_carts": features.total_abandoned_carts,
        "days_since_last_purchase": features.days_since_last_purchase,
        "last_payment_method": features.last_payment_method,
        "preferred_category": features.preferred_category,
        "total_revenue_generated": features.total_revenue_generated,
        "previous_recovery_attempts": features.previous_recovery_attempts,
        "previous_recovery_successes": features.previous_recovery_successes,
        "coupon_usage_rate": features.coupon_usage_rate,
        "failure_type": features.failure_type,
        "recovery_signal": features.recovery_signal,
        "recoverable_revenue": features.recoverable_amount,
        "cart_value": features.cart_value,
        "has_low_stock_items": features.has_low_stock_items,
        "cart_items": features.cart_items[:5],  # Limit to top 5 items
    }

    context = {
        "merchant_metrics": merchant_metrics,
        "customer_profile": customer_profile,
        "prompt_version": PROMPT_VERSION,
    }

    instruction = """
You are a senior revenue recovery AI for an Indian e-commerce platform powered by RevenuePilot.

Analyze the customer profile and generate a personalized recovery campaign.

STRICT RULES & CONSTRAINTS:
1. Consider payment failure type, recoverable revenue, segment, and past recovery history.
2. If probability < 60, set recovery_probability below 60.
3. Recommended discount should be 20 for CRITICAL (>=90 score), 15 for HIGH (>=75 score), or 10 for MEDIUM (>=60 score).
4. Generate personalized templates:
   - email_subject: Catchy subject mentioning discount or payment status.
   - email_body_html: Responsive HTML containing RevenuePilot logo area, customer greeting with first name, payment summary (failed amount & reason), coupon code highlight block with 24h expiry notice, clear CTA button ("Complete Payment"), and merchant footer.
   - email_body_text: Matching plain text version.
   - sms_message: Under 160 characters. Must include coupon code, 24h expiry, and recoverable amount. Format e.g.: "RevenuePilot: Your ₹3562 payment is waiting. Use RP20_A91F for 20% OFF today."
   - whatsapp_message: Conversational WhatsApp message with emojis, <= 300 characters. Format e.g.: "👋 Hi Rohan! We saved your order worth ₹3562. Use RP20_A91F within 24 hours for 20% OFF."
5. All currency values are in INR (₹).
6. Return ONLY valid JSON matching the exact key format. No markdown fences.

REQUIRED JSON FIELDS:
{
  "recovery_probability": <integer 0-100>,
  "recoverable_revenue": <float>,
  "recommended_discount": <integer 10 | 15 | 20>,
  "recommended_channel": "EMAIL+SMS",
  "reasoning": <string, max 300 chars>,
  "email_subject": <string>,
  "email_body_html": <string, HTML>,
  "email_body_text": <string, plain text>,
  "sms_message": <string, max 160 chars>,
  "whatsapp_message": <string, max 300 chars>
}
""".strip()

    return f"{instruction}\n\nCUSTOMER DATA:\n{json.dumps(context, indent=2, default=str)}"

