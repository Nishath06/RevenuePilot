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
You are a senior revenue recovery AI for an Indian e-commerce platform.

Analyze the customer profile and decide whether to launch a personalized recovery campaign.

STRICT RULES:
- Consider payment failure type, cart value, segment, and past recovery history.
- Never recommend recovery below 60% probability.
- Discount cap: 20% maximum. VIP/Loyal customers get higher discounts.
- Channel priority: EMAIL+SMS for high value, SMS only for low cart value.
- Best send time: 6–9 PM IST for maximum open rates.
- Generate personalized content using the customer's segment and failure type.
- All currency values are in INR (₹).
- Return ONLY valid JSON. No markdown, no explanation.

REQUIRED JSON FIELDS (all mandatory):
{
  "recovery_probability": <integer 0-100>,
  "recoverable_revenue": <float>,
  "recommended_discount": <integer 5-20>,
  "recommended_channel": <"EMAIL+SMS" | "EMAIL" | "SMS" | "WHATSAPP+EMAIL">,
  "best_send_time": <string, e.g. "18:30 IST">,
  "reasoning": <string, max 300 chars>,
  "email_subject": <string>,
  "email_body_html": <string, HTML>,
  "email_body_text": <string, plain text>,
  "sms_message": <string, max 160 chars>,
  "whatsapp_message": <string>
}
""".strip()

    return f"{instruction}\n\nCUSTOMER DATA:\n{json.dumps(context, indent=2, default=str)}"
