"""
RevenuePilot v4.0 — Recovery Scoring Engine
============================================
Calculates customer behavioral features, assigns segments,
generates coupons, and scores recovery candidates.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


# ── Data Models ────────────────────────────────────────────────────────────────

@dataclass
class CustomerFeatures:
    customer_id: str
    merchant_id: str
    # Identity
    name: str = "Customer"
    email: str = ""
    phone: str = ""
    # Purchase behaviour
    lifetime_value: float = 0.0
    average_order_value: float = 0.0
    total_successful_orders: int = 0
    total_failed_payments: int = 0
    total_cancelled_orders: int = 0
    total_abandoned_carts: int = 0
    days_since_last_purchase: int = 999
    last_payment_method: str = "unknown"
    preferred_category: str = "general"
    total_revenue_generated: float = 0.0
    # Recovery behaviour
    previous_recovery_attempts: int = 0
    previous_recovery_successes: int = 0
    coupon_usage_rate: float = 0.0
    # Inventory signals
    cart_items: List[Dict[str, Any]] = field(default_factory=list)
    cart_value: float = 0.0
    has_low_stock_items: bool = False
    # Payment failure type
    failure_type: str = "UNKNOWN"
    recovery_signal: str = "PAYMENT_FAILED"
    # Raw recoverable amount
    recoverable_amount: float = 0.0


@dataclass
class RecoveryCandidate:
    candidate_id: str
    customer_id: str
    merchant_id: str
    order_id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    # Scoring
    recovery_score: float
    confidence: float
    priority: str                   # CRITICAL / HIGH / MEDIUM / IGNORE
    recoverable_revenue: float
    recommended_discount: int
    coupon_code: str
    coupon_expiry_hours: int
    recommended_channel: str
    reasoning: str
    # Personalised content
    email_subject: str
    email_body_html: str
    email_body_text: str
    sms_message: str
    whatsapp_message: str
    # Meta
    segment: str
    llm_provider: str
    llm_model: str
    trace_id: str
    status: str = "SCHEDULED"
    recovery_status: str = "SCHEDULED"
    recovery_signal: str = "PAYMENT_FAILED"
    created_at: str = ""
    expires_at: str = ""
    updated_at: str = ""
    scheduled_send_time: str = ""
    last_action: Optional[str] = None
    message_history: List[Dict[str, Any]] = field(default_factory=list)
    dispatch_metadata: Dict[str, Any] = field(default_factory=dict)
    failure_reason: str = "Payment Failed"

    def to_dict(self) -> Dict[str, Any]:
        d = self.__dict__.copy()
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        if not d.get("created_at"):
            d["created_at"] = now_iso
        if not d.get("updated_at"):
            d["updated_at"] = now_iso
        if not d.get("expires_at"):
            d["expires_at"] = (now_dt + timedelta(hours=d.get("coupon_expiry_hours", 24))).isoformat()
        if not d.get("dispatch_metadata"):
            d["dispatch_metadata"] = {
                "email_sent": False,
                "sms_sent": False,
                "dispatch_time": None,
                "campaign_run_id": None,
            }
        d["recovery_status"] = d.get("status", "SCHEDULED")
        return d


# ── Feature Engineering ────────────────────────────────────────────────────────

async def compute_customer_features(
    db: Any,
    merchant_id: str,
    customer_id: str,
    raw: Dict[str, Any],
) -> CustomerFeatures:
    """
    Enriches a raw customer record with behavioral features from all collections.
    All queries are merchant-isolated.
    """
    mq = {"merchant_id": merchant_id}

    features = CustomerFeatures(customer_id=customer_id, merchant_id=merchant_id)
    features.name = (
        raw.get("customer_name") or raw.get("name") or raw.get("full_name") or "Customer"
    )
    features.email = raw.get("customer_email") or raw.get("email") or ""
    features.phone = raw.get("customer_phone") or raw.get("phone") or ""
    features.recovery_signal = raw.get("_recovery_signal", "PAYMENT_FAILED")
    features.recoverable_amount = float(
        raw.get("amount") or raw.get("total_amount") or raw.get("cart_total") or raw.get("subtotal") or 1999.0
    )

    cid_query = {
        **mq,
        "$or": [
            {"customer_id": customer_id},
            {"customer_email": features.email},
        ],
    }

    # ── Orders ────────────────────────────────────────────────────────────────
    try:
        orders = await db.orders.find(cid_query, {"_id": 0}).to_list(length=200)
        paid = [o for o in orders if str(o.get("payment_status", "")).upper() in ("PAID", "SUCCESS", "COMPLETED")]
        cancelled = [o for o in orders if str(o.get("payment_status", "")).upper() in ("CANCELLED",)]
        features.total_successful_orders = len(paid)
        features.total_cancelled_orders = len(cancelled)
        features.total_revenue_generated = sum(float(o.get("total_amount") or 0) for o in paid)
        features.lifetime_value = features.total_revenue_generated
        features.average_order_value = (
            features.lifetime_value / max(len(paid), 1)
        )
        if paid:
            last_order = max(paid, key=lambda o: str(o.get("created_at", "")))
            last_dt = str(last_order.get("created_at", ""))
            if last_dt:
                try:
                    parsed = datetime.fromisoformat(last_dt.rstrip("Z"))
                    features.days_since_last_purchase = (
                        datetime.now(timezone.utc).replace(tzinfo=None) - parsed.replace(tzinfo=None)
                    ).days
                except Exception:
                    pass
        # Preferred category from items
        cat_counts: Dict[str, int] = {}
        for o in paid:
            for it in o.get("items", []):
                cat = it.get("category", "general")
                cat_counts[cat] = cat_counts.get(cat, 0) + 1
        if cat_counts:
            features.preferred_category = max(cat_counts, key=cat_counts.get)  # type: ignore
    except Exception as exc:
        logger.warning("Orders feature fetch error", customer_id=customer_id, error=str(exc))

    # ── Payments ──────────────────────────────────────────────────────────────
    try:
        payments = await db.payments.find(cid_query, {"_id": 0}).to_list(length=100)
        failed = [p for p in payments if str(p.get("status", "")).upper() in ("FAILED", "DECLINED")]
        features.total_failed_payments = len(failed)
        if failed:
            last_fail = failed[-1]
            features.last_payment_method = last_fail.get("payment_method") or last_fail.get("method") or "unknown"
            reason = str(last_fail.get("failure_reason") or last_fail.get("error_code") or "UNKNOWN").upper()
            if "TIMEOUT" in reason or "GATEWAY" in reason:
                features.failure_type = "GATEWAY_TIMEOUT"
            elif "DECLINED" in reason or "CARD" in reason:
                features.failure_type = "CARD_DECLINED"
            elif "UPI" in reason:
                features.failure_type = "UPI_FAILURE"
            elif "WALLET" in reason:
                features.failure_type = "WALLET_FAILURE"
            elif "NETBANK" in reason or "NET_BANKING" in reason:
                features.failure_type = "NETBANKING_FAILURE"
            else:
                features.failure_type = "UNKNOWN"
    except Exception as exc:
        logger.warning("Payments feature fetch error", customer_id=customer_id, error=str(exc))

    # ── Recovery History ──────────────────────────────────────────────────────
    try:
        campaigns = await db.recovery_candidates.find(cid_query, {"_id": 0}).to_list(length=50)
        features.previous_recovery_attempts = len(campaigns)
        success = [c for c in campaigns if str(c.get("status", "")).upper() in ("RECOVERED", "DISPATCHED", "EMAIL_SENT", "SMS_SENT")]
        features.previous_recovery_successes = len(success)
        coupon_used = [c for c in campaigns if c.get("coupon_code")]
        features.coupon_usage_rate = len(coupon_used) / max(len(campaigns), 1)
    except Exception:
        pass

    # ── Cart / Abandoned ──────────────────────────────────────────────────────
    try:
        cart = await db.cart_events.find_one(cid_query, {"_id": 0})
        if cart:
            features.cart_items = cart.get("items") or []
            features.cart_value = float(cart.get("cart_total") or features.recoverable_amount)
            features.total_abandoned_carts = 1
    except Exception:
        pass

    features.cart_value = features.cart_value or features.recoverable_amount

    return features


# ── Segmentation ──────────────────────────────────────────────────────────────

def assign_segment(f: CustomerFeatures) -> str:
    """Assigns a single business segment to the customer."""
    ltv = f.lifetime_value

    if ltv > 50_000:
        return "VIP"
    if ltv > 20_000 and f.total_successful_orders >= 5:
        return "LOYAL"
    if f.total_successful_orders == 0:
        return "NEW"
    if f.days_since_last_purchase > 90 and ltv > 0:
        return "CHURN_RISK"
    if f.days_since_last_purchase > 30:
        return "AT_RISK"
    if ltv > 10_000:
        return "HIGH_VALUE"
    if f.coupon_usage_rate > 0.5:
        return "PRICE_SENSITIVE"
    return "AT_RISK"


# ── Coupon Generation ─────────────────────────────────────────────────────────

import random
import string

def generate_coupon(
    segment: str,
    ltv: float,
    recovery_score: float,
    expire_hours: int = 24,
) -> Dict[str, Any]:
    if recovery_score >= 90:
        pct = 20
    elif segment == "VIP" or (recovery_score >= 75 and segment not in ("LOYAL", "NEW")):
        pct = 15
    elif segment == "LOYAL" or (recovery_score >= 60 and segment != "NEW"):
        pct = 10
    elif segment == "NEW":
        pct = 5
    else:
        pct = 10

    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    code = f"RP{pct}_{suffix}"
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expire_hours)).isoformat()

    return {
        "coupon_code": code,
        "discount_percentage": pct,
        "expires_at": expires_at,
        "coupon_expiry_hours": expire_hours,
        "is_single_use": True,
    }


# ── Scoring ───────────────────────────────────────────────────────────────────

def score_candidate(
    customer_id: str,
    merchant_id: str,
    features: CustomerFeatures,
    segment: str,
    llm_decision: Dict[str, Any],
    customer_raw: Dict[str, Any],
    trace_id: str = "",
) -> RecoveryCandidate:
    """
    Converts LLM decision + features into a scored RecoveryCandidate.
    Score thresholds:
      90–100 → CRITICAL, 20% discount
      75–89  → HIGH, 15% discount
      60–74  → MEDIUM, 10% discount
      < 60   → IGNORE, no candidate
    """
    raw_score = float(llm_decision.get("recovery_probability", 65))
    if features.recoverable_amount > 5000:
        raw_score = min(100, raw_score + 5)
    if features.failure_type == "GATEWAY_TIMEOUT":
        raw_score = min(100, raw_score + 3)
    if features.previous_recovery_successes > 0:
        raw_score = min(100, raw_score + 4)

    score = round(raw_score, 1)

    if score >= 90:
        priority = "CRITICAL"
    elif score >= 75:
        priority = "HIGH"
    elif score >= 60:
        priority = "MEDIUM"
    else:
        priority = "IGNORE"

    confidence = min(1.0, round(score / 100 + 0.02, 3))

    coupon_data = generate_coupon(segment, features.lifetime_value, score, expire_hours=24)
    discount = coupon_data["discount_percentage"]

    order_id = (
        customer_raw.get("order_id")
        or customer_raw.get("payment_id")
        or (f"cart_{customer_id}" if "ABANDONED" in features.recovery_signal else f"ord_{uuid.uuid4().hex[:8]}")
    )

    failure_reason = customer_raw.get("failure_reason") or customer_raw.get("error_code") or ("Checkout Abandoned" if "ABANDONED" in features.recovery_signal else "Payment Failed")

    from app.core.config import settings
    llm_provider_name = "gemini"
    llm_model_name = str(getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash"))

    now_iso = datetime.now(timezone.utc).isoformat()

    return RecoveryCandidate(
        candidate_id=f"cand_{uuid.uuid4().hex[:10]}",
        customer_id=customer_id,
        merchant_id=merchant_id,
        order_id=order_id,
        customer_name=features.name,
        customer_email=features.email,
        customer_phone=features.phone,
        recovery_score=score,
        confidence=confidence,
        priority=priority,
        recoverable_revenue=float(llm_decision.get("recoverable_revenue", features.recoverable_amount)),
        recommended_discount=discount,
        coupon_code=coupon_data["coupon_code"],
        coupon_expiry_hours=24,
        recommended_channel=str(llm_decision.get("recommended_channel", "EMAIL+SMS")),
        reasoning=str(llm_decision.get("reasoning", "AI-determined high probability recovery opportunity"))[:1000],
        email_subject=str(llm_decision.get("email_subject", f"Complete your payment — {discount}% OFF expires tonight")),
        email_body_html=str(llm_decision.get("email_body_html", "")),
        email_body_text=str(llm_decision.get("email_body_text", "")),
        sms_message=str(llm_decision.get("sms_message", f"RevenuePilot: Your ₹{int(features.recoverable_amount)} payment is waiting. Use {coupon_data['coupon_code']} for {discount}% OFF today.")),
        whatsapp_message=str(llm_decision.get("whatsapp_message", f"👋 Hi {features.name}! We saved your order worth ₹{int(features.recoverable_amount)}. Use {coupon_data['coupon_code']} within 24 hours for {discount}% OFF.")),
        segment=segment,
        llm_provider=llm_provider_name,
        llm_model=llm_model_name,
        trace_id=trace_id or f"trace_{uuid.uuid4().hex[:10]}",
        status="SCHEDULED" if priority != "IGNORE" else "IGNORE",
        recovery_status="SCHEDULED" if priority != "IGNORE" else "IGNORE",
        recovery_signal=features.recovery_signal,
        created_at=now_iso,
        expires_at=coupon_data["expires_at"],
        updated_at=now_iso,
        scheduled_send_time="",
        last_action=None,
        message_history=[{
            "timestamp": now_iso,
            "action": "Candidate Created",
            "by": "RecoveryIntelligenceAgent",
            "details": f"Candidate scheduled with score {score} and coupon {coupon_data['coupon_code']}"
        }],
        dispatch_metadata={
            "email_sent": False,
            "sms_sent": False,
            "dispatch_time": None,
            "campaign_run_id": None
        },
        failure_reason=failure_reason,
    )


from app.core.config import settings  # noqa: E402
SCORE_THRESHOLD: float = float(getattr(settings, "RECOVERY_AGENT_SCORE_THRESHOLD", 60))

