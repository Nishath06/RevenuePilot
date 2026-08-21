"""
RevenuePilot AI — Payment Agent
Specialist agent for Razorpay payment analytics.
"""
from __future__ import annotations

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from app.core.config import settings
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.tools.payment_tools import PaymentTools
from app.tools.recommendation_tools import RecommendationTools


def build_payment_agent() -> Agent:
    return Agent(
        name="Payment Agent",
        role="Expert in Razorpay payment analytics, failure analysis, and method optimization.",
        model=OpenAIChat(id=settings.OPENAI_MODEL, api_key=settings.OPENAI_API_KEY),
        tools=[PaymentTools(), RecommendationTools()],
        instructions=[
            SYSTEM_PROMPT,
            "You specialize in payment analytics: success rates, failure analysis, method breakdowns.",
            "Always call get_all_payment_metrics first.",
            "Identify any payment failures and explain potential reasons.",
            "Call generate_payment_recommendations to suggest optimizations.",
            "Reference Razorpay-specific payment methods: UPI, Netbanking, Card, Wallet.",
        ],
        markdown=False,
        debug_mode=False,
    )
