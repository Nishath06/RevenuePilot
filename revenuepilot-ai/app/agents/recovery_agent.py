"""
RevenuePilot AI — Recovery Agent
Specialist agent for abandoned carts and failed payment recovery outreach.
"""
from __future__ import annotations

from agno.agent import Agent
from app.agents.factory import get_llm_model
from app.llm.provider import BaseLLMProvider
from app.prompts.recovery_prompt import RECOVERY_PROMPT
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.tools.customer_tools import CustomerTools
from app.tools.payment_tools import PaymentTools
from app.tools.recommendation_tools import RecommendationTools
from app.tools.recovery_tools import RecoveryTools


def build_recovery_agent(provider: BaseLLMProvider | None = None) -> Agent:
    return Agent(
        name="Recovery Agent",
        role="Expert in identifying and recovering lost revenue from abandoned carts and failed payments.",
        model=get_llm_model(provider),
        tools=[RecoveryTools(), PaymentTools(), CustomerTools(), RecommendationTools()],
        instructions=[
            SYSTEM_PROMPT,
            RECOVERY_PROMPT,
            "You specialize in revenue recovery: abandoned carts, failed payments, priority recovery targets.",
            "Always call abandoned_cart_customers and failed_payment_recovery_targets first to retrieve live target contacts.",
            "Always call generate_recovery_campaign to provide copy-paste WhatsApp and Email recovery templates with coupon codes.",
            "Prioritize by order amount and priority score — High priority targets first.",
        ],
        markdown=False,
        debug_mode=False,
    )
