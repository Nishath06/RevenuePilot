"""
RevenuePilot v4.0 — Autonomous Recovery Intelligence Agent
==========================================================
Analyzes every customer, runs an LLM decision engine, scores recovery probability,
generates personalized multi-channel campaign content, and writes APPROVED candidates
to `recovery_candidates` — ready for RecoveryLambda execution.

Architecture:
  EventBridge Cron → RecoveryIntelligenceAgent → MongoDB recovery_candidates → RecoveryLambda → SES/SNS
"""
from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import get_logger
from app.db.mongodb import get_mongodb
from app.services.recovery_scoring import (
    RecoveryCandidate,
    compute_customer_features,
    score_candidate,
    assign_segment,
    generate_coupon,
)
from app.services.recovery_prompt_builder import build_recovery_prompt
from app.services.recovery_candidate_repository import RecoveryCandidateRepository
from app.services.aws_cloudwatch import put_metric
from app.services.aws_eventbridge import aws_manager
from app.core.config import settings

logger = get_logger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
BATCH_SIZE: int = int(getattr(settings, "RECOVERY_AGENT_BATCH_SIZE", 25))
SCORE_THRESHOLD: float = float(getattr(settings, "RECOVERY_AGENT_SCORE_THRESHOLD", 60))
CACHE_HOURS: int = int(getattr(settings, "RECOVERY_AGENT_CACHE_HOURS", 6))
IS_LOCAL: bool = getattr(settings, "AWS_MODE", "local").lower() != "cloud"


# ── LLM Integration ───────────────────────────────────────────────────────────

_sem: Optional[asyncio.Semaphore] = None


def _get_semaphore() -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(3)
    return _sem


async def _call_llm(prompt: str, trace_id: str) -> Dict[str, Any]:
    """
    Calls the configured LLM provider with the recovery prompt.
    Uses asyncio.Semaphore(3) to limit concurrency to 3 requests max.
    Retries up to 3 times with exponential backoff (1s, 2s, 4s) on HTTP 429 or API errors.
    Preserves trace_id in retry logs and continues processing.
    Falls back to deterministic simulation ONLY after all retries fail.
    """
    if IS_LOCAL or not getattr(settings, "GEMINI_API_KEY", ""):
        return _simulate_llm_response(prompt)

    sem = _get_semaphore()
    async with sem:
        from app.llm.factory import LLMFactory
        provider = LLMFactory.get_provider()

        max_retries = 3
        backoff_delays = [1.0, 2.0, 4.0]
        start = time.perf_counter()

        for attempt in range(1, max_retries + 1):
            try:
                raw = await provider.generate(
                    messages=[
                        {"role": "system", "content": "You are a revenue recovery AI. Respond in strict JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.3,
                    max_tokens=1200,
                )
                # Strip markdown fences if present
                clean = re.sub(r"```(?:json)?|```", "", raw).strip()
                parsed = json.loads(clean)
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                _emit_cloudwatch("AverageLLMLatency", latency_ms)
                return parsed
            except Exception as exc:
                delay = backoff_delays[attempt - 1] if attempt <= len(backoff_delays) else 4.0
                logger.warning(
                    "Gemini API call failed — retrying with exponential backoff",
                    attempt=attempt,
                    max_retries=max_retries,
                    backoff_seconds=delay,
                    error=str(exc),
                    trace_id=trace_id,
                )
                if attempt < max_retries:
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        "Gemini API call failed after max retries — using simulation fallback",
                        attempts=max_retries,
                        error=str(exc),
                        trace_id=trace_id,
                    )
                    return _simulate_llm_response(prompt)

        return _simulate_llm_response(prompt)


def _simulate_llm_response(prompt: str) -> Dict[str, Any]:
    """
    Deterministic simulation used in LOCAL mode or when no LLM key is configured.
    Produces realistic recovery decisions without any API call.
    """
    # Extract recoverable revenue hint from prompt for realistic values
    rev_match = re.search(r'"recoverable_revenue"\s*:\s*([\d.]+)', prompt)
    rev = float(rev_match.group(1)) if rev_match else 3499.0

    recovery_prob = min(95, max(60, int(rev / 100)))
    discount = 20 if recovery_prob >= 90 else (15 if recovery_prob >= 75 else 10)

    return {
        "recovery_probability": recovery_prob,
        "recoverable_revenue": round(rev, 2),
        "recommended_discount": discount,
        "recommended_channel": "EMAIL+SMS",
        "best_send_time": "18:00 IST",
        "reasoning": f"Customer shows high purchase intent with cart value ₹{rev:,.0f}. Gateway timeout detected. Best recovery window is evening.",
        "email_subject": f"Your ₹{rev:,.0f} cart is waiting — {discount}% off just for you",
        "email_body_html": (
            f"<p>Hi there,</p>"
            f"<p>We noticed you left ₹{rev:,.0f} worth of items in your cart. "
            f"We've reserved your items for <strong>24 hours</strong>.</p>"
            f"<p>Use code <strong>RECOVER{discount}</strong> at checkout for <strong>{discount}% off</strong>!</p>"
            f"<p>⏰ Offer expires in 24 hours.</p>"
            f"<p>— RevenuePilot Recovery Team</p>"
        ),
        "email_body_text": (
            f"Hi,\n\nYour cart worth ₹{rev:,.0f} is waiting.\n"
            f"Use code RECOVER{discount} for {discount}% off.\n\n"
            f"Hurry — offer expires in 24 hours.\n\nRevenuePilot Team"
        ),
        "sms_message": f"RevenuePilot: Your cart ₹{rev:,.0f} reserved! Use RECOVER{discount} for {discount}% OFF. Expires 24h.",
        "whatsapp_message": f"👋 Hey! Your cart worth ₹{rev:,.0f} is still saved.\nUse *RECOVER{discount}* for *{discount}% off* — valid for 24 hours only! ⏰",
    }


# ── CloudWatch Helpers ─────────────────────────────────────────────────────────

def _emit_cloudwatch(metric: str, value: float, unit: str = "None") -> None:
    try:
        put_metric(metric, value, unit, namespace="RevenuePilot/RecoveryAI")
    except Exception:
        pass


# ── Audit Logger ───────────────────────────────────────────────────────────────

async def _write_audit_log(
    db: Any,
    trace_id: str,
    merchant_id: str,
    customer_id: str,
    score: float,
    reasoning: str,
    model: str,
    latency_ms: float,
    prompt_version: str = "v4.0",
) -> None:
    try:
        await db.aws_audit_logs.insert_one({
            "log_id": f"audit_{uuid.uuid4().hex[:10]}",
            "action": "RECOVERY_AI_DECISION",
            "trace_id": trace_id,
            "merchant_id": merchant_id,
            "customer_id": customer_id,
            "recovery_score": score,
            "reasoning": reasoning[:500],
            "prompt_version": prompt_version,
            "llm_model": model,
            "latency_ms": latency_ms,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.warning("Audit log write failed", error=str(exc))


# ── Main Agent ─────────────────────────────────────────────────────────────────

class RecoveryIntelligenceAgent:
    """
    Autonomous AI agent that:
    1. Fetches customers with recovery signals (failed payments, abandoned carts, cancellations)
    2. Computes behavioral features per customer
    3. Calls LLM for personalized recovery decisions in batches
    4. Scores and filters candidates above SCORE_THRESHOLD
    5. Writes APPROVED candidates to MongoDB `recovery_candidates`
    6. Publishes RECOVERY_CANDIDATES_CREATED EventBridge event
    7. Emits CloudWatch metrics
    """

    def __init__(self) -> None:
        self.repo = RecoveryCandidateRepository()

    async def run(
        self,
        merchant_id: str = "merch_default",
        period: str = "all",
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        trace_id = trace_id or f"trace_ria_{uuid.uuid4().hex[:10]}"
        start_ts = time.perf_counter()
        db = get_mongodb()

        logger.info("RecoveryIntelligenceAgent starting", merchant_id=merchant_id, period=period, trace_id=trace_id)

        # ── 1. Fetch eligible customers ─────────────────────────────────────
        customers = await self._fetch_recovery_candidates(db, merchant_id, trace_id, period=period)
        _emit_cloudwatch("CustomersAnalyzed", float(len(customers)))

        if not customers:
            logger.info("No eligible customers found", merchant_id=merchant_id)
            return {
                "status": "SUCCESS",
                "customers_analyzed": 0,
                "candidates_created": 0,
                "failed_payments": 0,
                "cancelled_payments": 0,
                "abandoned_carts": 0,
                "recoverable_revenue": 0.0,
                "scheduled_campaign_time": "Today 6:00 PM IST",
                "campaign_status": "SCHEDULED",
                "trace_id": trace_id,
            }

        # ── 2. Process in batches ────────────────────────────────────────────
        approved: List[RecoveryCandidate] = []
        merchant_metrics = await self._get_merchant_metrics(db, merchant_id)

        for i in range(0, len(customers), BATCH_SIZE):
            batch = customers[i : i + BATCH_SIZE]
            batch_results = await asyncio.gather(
                *[self._process_customer(db, c, merchant_id, merchant_metrics, trace_id) for c in batch],
                return_exceptions=True,
            )
            for result in batch_results:
                if isinstance(result, RecoveryCandidate) and result.priority != "IGNORE":
                    approved.append(result)

        # ── 3. Schedule Campaign (Target 6:00 PM IST) ─────────────────────
        campaign_id = f"camp_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

        tz_str = "Asia/Kolkata"
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            tz = timezone(timedelta(hours=5, minutes=30))

        now_tz = datetime.now(tz)
        scheduled_time = now_tz.replace(hour=18, minute=0, second=0, microsecond=0)
        is_today = True
        if now_tz > scheduled_time:
            scheduled_time = scheduled_time + timedelta(days=1)
            is_today = False

        scheduled_time_iso = scheduled_time.isoformat()
        scheduled_display_time = f"{'Today' if is_today else 'Tomorrow'} 6:00 PM IST"

        for cand in approved:
            cand.scheduled_send_time = scheduled_time_iso

        # ── 4. Persist candidates to MongoDB ──────────────────────────────
        inserted = await self.repo.upsert_candidates(approved, merchant_id)
        _emit_cloudwatch("CandidatesApproved", float(inserted))
        _emit_cloudwatch("CouponGenerated", float(inserted))

        recoverable = sum(c.recoverable_revenue for c in approved)
        _emit_cloudwatch("RecoverableRevenue", recoverable, unit="None")

        # Counts by category
        failed_count = sum(1 for c in approved if "PAYMENT" in getattr(c, "recovery_signal", ""))
        cancelled_count = sum(1 for c in approved if "CANCEL" in getattr(c, "recovery_signal", ""))
        abandoned_count = sum(1 for c in approved if "ABANDON" in getattr(c, "recovery_signal", ""))

        # ── 5. Publish EventBridge event & audit log ──────────────────────
        elapsed_ms = round((time.perf_counter() - start_ts) * 1000, 2)
        event_detail = {
            "trace_id": trace_id,
            "merchant_id": merchant_id,
            "customers_analyzed": len(customers),
            "candidates_approved": inserted,
            "recoverable_revenue": recoverable,
            "elapsed_ms": elapsed_ms,
        }
        try:
            aws_manager.publish_eventbridge(
                event_type="RECOVERY_CANDIDATES_CREATED",
                detail=event_detail,
                source="revenuepilot.recovery.ai",
            )
        except Exception as exc:
            logger.warning("EventBridge publish failed", error=str(exc))

        # Campaign summary
        campaign_summary = {
            "campaign_id": campaign_id,
            "merchant_id": merchant_id,
            "customers_analyzed": len(customers),
            "candidates_created": inserted,
            "failed_payments": failed_count,
            "cancelled_payments": cancelled_count,
            "abandoned_carts": abandoned_count,
            "recoverable_revenue": round(recoverable, 2),
            "scheduled_send_time": scheduled_time_iso,
            "status": "SCHEDULED",
        }
        await self.repo.create_campaign_run(campaign_summary)

        logger.info(
            "RecoveryIntelligenceAgent completed",
            customers_analyzed=len(customers),
            candidates_created=inserted,
            recoverable_revenue=recoverable,
            elapsed_ms=elapsed_ms,
            trace_id=trace_id,
            campaign_id=campaign_id,
        )

        return {
            "status": "SUCCESS",
            "success": True,
            "campaign_id": campaign_id,
            "customers_analyzed": len(customers),
            "candidates_created": inserted,
            "failed_payments": failed_count,
            "cancelled_payments": cancelled_count,
            "abandoned_carts": abandoned_count,
            "recoverable_revenue": round(recoverable, 2),
            "scheduled_campaign_time": scheduled_display_time,
            "campaign_status": "SCHEDULED",
            "trace_id": trace_id,
        }

    # ── Customer Fetching ──────────────────────────────────────────────────────

    async def _fetch_recovery_candidates(
        self, db: Any, merchant_id: str, trace_id: str, period: str = "all"
    ) -> List[Dict[str, Any]]:
        """
        Fetch customers with recovery signals from multiple collections.
        De-duplicates by customer_id. Skips customers analyzed < CACHE_HOURS ago.
        """
        cache_cutoff = (datetime.now(timezone.utc) - timedelta(hours=CACHE_HOURS)).isoformat()

        # Already analyzed recently?
        recently_analyzed_ids: set = set()
        try:
            cursor = db.recovery_candidates.find(
                {"merchant_id": merchant_id, "created_at": {"$gte": cache_cutoff}},
                {"customer_id": 1},
            )
            async for doc in cursor:
                if doc.get("customer_id"):
                    recently_analyzed_ids.add(str(doc["customer_id"]))
        except Exception:
            pass

        customers: Dict[str, Dict[str, Any]] = {}
        mq = {"merchant_id": merchant_id}
        from app.services.dashboard_analytics import _get_kolkata_date_filter
        date_flt = _get_kolkata_date_filter("created_at", period)

        # Source 1: Failed payments
        try:
            pay_query = {**mq, "status": {"$in": ["failed", "FAILED"]}}
            if date_flt:
                pay_query.update(date_flt)
            async for p in db.payments.find(pay_query, {"_id": 0}):
                cid = str(p.get("customer_id") or p.get("customer_email") or "anon")
                if cid not in recently_analyzed_ids:
                    customers.setdefault(cid, {}).update(p)
                    customers[cid]["_recovery_signal"] = "PAYMENT_FAILED"
        except Exception as exc:
            logger.warning("Failed payments fetch error", error=str(exc))

        # Source 2: Cancelled orders
        try:
            ord_query = {**mq, "payment_status": {"$in": ["CANCELLED", "cancelled", "Failed", "failed"]}}
            if date_flt:
                ord_query.update(date_flt)
            async for o in db.orders.find(ord_query, {"_id": 0}).limit(200):
                cid = str(o.get("customer_id") or o.get("customer_email") or "anon")
                if cid not in recently_analyzed_ids and cid not in customers:
                    customers.setdefault(cid, {}).update(o)
                    sig = "ORDER_CANCELLED" if str(o.get("payment_status")).upper() == "CANCELLED" else "PAYMENT_FAILED"
                    customers[cid]["_recovery_signal"] = sig
        except Exception as exc:
            logger.warning("Cancelled orders fetch error", error=str(exc))

        # Source 3: Customers collection directly
        try:
            cust_query = mq.copy()
            if date_flt:
                cust_query.update(date_flt)
            async for c in db.customers.find(cust_query, {"_id": 0}).limit(200):
                cid = str(c.get("customer_id") or c.get("id") or c.get("email") or "anon")
                if cid not in recently_analyzed_ids:
                    customers.setdefault(cid, {}).update(c)
        except Exception as exc:
            logger.warning("Customers fetch error", error=str(exc))

        # Simulation fallback
        if not customers:
            customers = _generate_demo_customers(merchant_id)
            logger.info("Using simulation customers", count=len(customers), trace_id=trace_id)

        return list(customers.values())[:200]

    async def _get_merchant_metrics(self, db: Any, merchant_id: str) -> Dict[str, Any]:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            total_orders = await db.orders.count_documents({"merchant_id": merchant_id})
            revenue_agg = await db.orders.aggregate([
                {"$match": {"merchant_id": merchant_id, "created_at": {"$gte": cutoff}}},
                {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
            ]).to_list(length=1)
            return {
                "total_orders_30d": total_orders,
                "total_revenue_30d": revenue_agg[0]["total"] if revenue_agg else 148500.0,
            }
        except Exception:
            return {"total_orders_30d": 250, "total_revenue_30d": 148500.0}

    # ── Per-Customer Processing ────────────────────────────────────────────────

    async def _process_customer(
        self,
        db: Any,
        customer_raw: Dict[str, Any],
        merchant_id: str,
        merchant_metrics: Dict[str, Any],
        trace_id: str,
    ) -> Optional[RecoveryCandidate]:
        """Full pipeline for one customer: features → LLM → score → candidate."""
        cid = str(
            customer_raw.get("customer_id")
            or customer_raw.get("id")
            or customer_raw.get("email")
            or uuid.uuid4().hex[:8]
        )

        try:
            # ── Feature engineering ──────────────────────────────────────────
            features = await compute_customer_features(db, merchant_id, cid, customer_raw)
            segment = assign_segment(features)

            # ── Build LLM prompt ─────────────────────────────────────────────
            prompt = build_recovery_prompt(features, segment, merchant_metrics)

            # ── LLM call ─────────────────────────────────────────────────────
            llm_start = time.perf_counter()
            decision = await _call_llm(prompt, trace_id)
            llm_latency = round((time.perf_counter() - llm_start) * 1000, 2)

            # ── Scoring ───────────────────────────────────────────────────────
            candidate = score_candidate(
                customer_id=cid,
                merchant_id=merchant_id,
                features=features,
                segment=segment,
                llm_decision=decision,
                customer_raw=customer_raw,
            )

            # ── Audit log ──────────────────────────────────────────────────────
            await _write_audit_log(
                db=db,
                trace_id=trace_id,
                merchant_id=merchant_id,
                customer_id=cid,
                score=candidate.recovery_score,
                reasoning=decision.get("reasoning", ""),
                model=getattr(settings, "GEMINI_MODEL", "local-sim"),
                latency_ms=llm_latency,
            )

            return candidate

        except Exception as exc:
            logger.warning("Customer processing failed", customer_id=cid, error=str(exc))
            return None


# ── Demo Data Simulation ───────────────────────────────────────────────────────

def _generate_demo_customers(merchant_id: str) -> Dict[str, Dict[str, Any]]:
    """Generate realistic demo customers when no live data exists."""
    names = [
        ("cust_001", "Nishath Admin", "jpnishath@gmail.com", "+919876543210", 4999.0, "PAYMENT_FAILED"),
        ("cust_002", "Nishath User", "nishath2306@gmail.com", "+919812345678", 2499.0, "ORDER_CANCELLED"),
        ("cust_003", "Priya Nair", "jpnishath@gmail.com", "+919765432100", 7999.0, "PAYMENT_FAILED"),
        ("cust_004", "Karthik Iyer", "nishath2306@gmail.com", "+919654321001", 1299.0, "ORDER_CANCELLED"),
        ("cust_005", "Deepika Singh", "jpnishath@gmail.com", "+919543210012", 12499.0, "PAYMENT_FAILED"),
    ]
    result = {}
    for cid, name, email, phone, amount, signal in names:
        result[cid] = {
            "customer_id": cid,
            "merchant_id": merchant_id,
            "customer_name": name,
            "customer_email": email,
            "customer_phone": phone,
            "amount": amount,
            "total_amount": amount,
            "_recovery_signal": signal,
            "payment_status": "FAILED" if "PAYMENT" in signal else "CANCELLED",
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat(),
        }
    return result


recovery_intelligence_agent = RecoveryIntelligenceAgent()
