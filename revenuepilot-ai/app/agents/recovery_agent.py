"""
RevenuePilot AI — Recovery Agent
Specialist agent for abandoned carts and failed payment recovery.
"""
from __future__ import annotations

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from app.core.config import settings
from app.prompts.recovery_prompt import RECOVERY_PROMPT
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.tools.customer_tools import CustomerTools
from app.tools.payment_tools import PaymentTools
from app.tools.recommendation_tools import RecommendationTools


def build_recovery_agent() -> Agent:
    return Agent(
        name="Recovery Agent",
        role="Expert in identifying and recovering lost revenue from abandoned carts and failed payments.",
        model=OpenAIChat(id=settings.OPENAI_MODEL, api_key=settings.OPENAI_API_KEY),
        tools=[CustomerTools(), PaymentTools(), RecommendationTools()],
        instructions=[
            SYSTEM_PROMPT,
            RECOVERY_PROMPT,
            "You specialize in revenue recovery: abandoned carts, failed payments, inactive customers.",
            "Always call get_abandoned_carts and get_failed_payments first.",
            "Generate ready-to-send WhatsApp and email messages for top recovery targets.",
            "Prioritize by cart/order value — highest value first.",
            "Call generate_customer_recommendations for retention strategies.",
        ],
        markdown=False,
        debug_mode=False,
    )
