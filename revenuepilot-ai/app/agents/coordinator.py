"""
RevenuePilot AI — Coordinator Agent
Routes merchant questions to the correct specialist agent
using intent classification — no hardcoded keyword matching.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

from agno.agent import Agent, RunOutput
from agno.models.openai import OpenAIChat

from app.agents.inventory_agent import build_inventory_agent
from app.agents.payment_agent import build_payment_agent
from app.agents.recovery_agent import build_recovery_agent
from app.agents.revenue_agent import build_revenue_agent
from app.core.config import settings
from app.core.logging import get_logger
from app.models.response import ChatResponse
from app.services import analytics
from app.tools.customer_tools import CustomerTools
from app.tools.inventory_tools import InventoryTools
from app.tools.payment_tools import PaymentTools
from app.tools.recommendation_tools import RecommendationTools
from app.tools.revenue_tools import RevenueTools

logger = get_logger(__name__)


@dataclass
class RoutingDecision:
    agent_name: str
    confidence: str
    reason: str


# ─────────────────────────────────────────────────────────────────────────────
# Intent Classifier (rule-assisted, LLM-confirmed)
# ─────────────────────────────────────────────────────────────────────────────

_INTENT_MAP: dict[str, list[str]] = {
    "Revenue Agent": [
        "revenue", "sales", "earning", "income", "profit", "growth",
        "average order", "aov", "today", "yesterday", "week", "month",
        "forecast", "trend", "turnover",
    ],
    "Payment Agent": [
        "payment", "failed", "failure", "razorpay", "upi", "card", "wallet",
        "netbanking", "method", "success rate", "captured", "declined",
        "transaction", "checkout",
    ],
    "Inventory Agent": [
        "stock", "inventory", "product", "out of stock", "low stock",
        "bestsell", "slow sell", "category", "reorder", "sku",
    ],
    "Recovery Agent": [
        "abandon", "cart", "recover", "inactive", "lost", "win back",
        "whatsapp", "email", "re-engage", "opportunity",
    ],
}


def _classify_intent(message: str) -> str:
    """
    Score each agent by keyword hits in the message.
    Returns the highest-scoring agent name.
    Falls back to Revenue Agent if tied or ambiguous.
    """
    msg_lower = message.lower()
    scores: dict[str, int] = {agent: 0 for agent in _INTENT_MAP}
    for agent, keywords in _INTENT_MAP.items():
        for kw in keywords:
            if kw in msg_lower:
                scores[agent] += 1

    best_agent = max(scores, key=lambda k: scores[k])
    best_score = scores[best_agent]

    if best_score == 0:
        return "Revenue Agent"  # safe default

    return best_agent


# ─────────────────────────────────────────────────────────────────────────────
# Fallback (no-LLM) responder for when OpenAI key is absent
# ─────────────────────────────────────────────────────────────────────────────

async def _fallback_response(message: str) -> ChatResponse:
    """
    When no OpenAI key is configured, return a data-only response
    built entirely from MongoDB metrics + rule-based recommendations.
    """
    agent_name = _classify_intent(message)
    start = time.perf_counter()

    revenue = await analytics.get_revenue_metrics()
    orders = await analytics.get_order_metrics()
    payments = await analytics.get_payment_metrics()

    metrics_dict = {
        "today_revenue": revenue.today,
        "week_revenue": revenue.this_week,
        "month_revenue": revenue.this_month,
        "growth_percentage": revenue.growth_percentage,
        "average_order_value": revenue.average_order_value,
        "paid_orders": orders.paid,
        "pending_orders": orders.pending,
        "payment_success_rate": payments.success_rate,
    }

    # Build a rule-based answer
    answer_lines = [
        f"**Summary**: Here is your live business snapshot.",
        f"**Metrics**:",
        f"  - Today's Revenue: ₹{revenue.today:,.2f}",
        f"  - This Week: ₹{revenue.this_week:,.2f}",
        f"  - Growth: {revenue.growth_percentage:+.1f}% vs yesterday",
        f"  - Paid Orders: {orders.paid} | Pending: {orders.pending}",
        f"  - Payment Success Rate: {payments.success_rate:.1f}%",
        f"**Insight**: Data is live from MongoDB. AI narration requires an OpenAI API key.",
        f"**Recommendation**: Configure OPENAI_API_KEY in .env to enable natural language responses.",
    ]

    recs: list[str] = []
    if revenue.growth_percentage < -20:
        recs.append("Revenue dropped >20%. Consider running a flash sale.")
    if payments.success_rate < 85:
        recs.append("Payment success rate below 85%. Review Razorpay webhook configuration.")
    if not recs:
        recs.append("Business metrics are within normal range.")

    elapsed = (time.perf_counter() - start) * 1000

    return ChatResponse(
        agent=agent_name,
        answer="\n".join(answer_lines),
        metrics=metrics_dict,
        recommendations=recs,
        execution_time_ms=round(elapsed, 2),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Coordinator
# ─────────────────────────────────────────────────────────────────────────────

class CoordinatorAgent:
    """
    Routes merchant questions to specialist agents.
    Falls back to rule-based responses when no LLM key is configured.
    """

    def __init__(self) -> None:
        self._agents: dict[str, Agent] = {}
        self._ai_enabled = bool(settings.OPENAI_API_KEY)
        if self._ai_enabled:
            self._build_agents()

    def _build_agents(self) -> None:
        self._agents = {
            "Revenue Agent": build_revenue_agent(),
            "Payment Agent": build_payment_agent(),
            "Inventory Agent": build_inventory_agent(),
            "Recovery Agent": build_recovery_agent(),
        }
        logger.info("Coordinator: specialist agents initialized", count=len(self._agents))

    @property
    def ai_ready(self) -> bool:
        return self._ai_enabled

    async def chat(self, message: str) -> ChatResponse:
        """
        Classify intent → route to specialist → return ChatResponse.
        """
        start = time.perf_counter()
        agent_name = _classify_intent(message)
        logger.info("Intent classified", agent=agent_name, message=message[:80])

        if not self._ai_enabled:
            logger.warning("OpenAI key not set — using fallback rule-based response")
            return await _fallback_response(message)

        agent = self._agents.get(agent_name)
        if agent is None:
            agent = self._agents["Revenue Agent"]
            agent_name = "Revenue Agent"

        try:
            response: RunOutput = await agent.arun(message)
            content = response.content or "I was unable to generate a response. Please try again."

            # Pull live metrics to attach to every response
            revenue = await analytics.get_revenue_metrics()
            orders = await analytics.get_order_metrics()
            payments = await analytics.get_payment_metrics()

            metrics_dict = {
                "today_revenue": revenue.today,
                "growth_percentage": revenue.growth_percentage,
                "paid_orders": orders.paid,
                "payment_success_rate": payments.success_rate,
            }

            # Rule-based recommendations always appended
            recs: list[str] = []
            if revenue.growth_percentage < -20:
                recs.append("Revenue dropped significantly. Consider running a flash sale.")
            if payments.success_rate < 85:
                recs.append("Payment success rate is low. Review Razorpay webhook and retry logic.")

            elapsed = (time.perf_counter() - start) * 1000

            return ChatResponse(
                agent=agent_name,
                answer=content,
                metrics=metrics_dict,
                recommendations=recs,
                execution_time_ms=round(elapsed, 2),
            )

        except Exception as exc:
            logger.error("Agent execution failed", agent=agent_name, error=str(exc))
            # Graceful degradation to fallback
            return await _fallback_response(message)


# Module-level singleton — created at app startup
coordinator: CoordinatorAgent | None = None


def get_coordinator() -> CoordinatorAgent:
    global coordinator
    if coordinator is None:
        coordinator = CoordinatorAgent()
    return coordinator
