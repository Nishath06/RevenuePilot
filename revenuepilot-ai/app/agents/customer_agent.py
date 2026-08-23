"""
RevenuePilot AI — Customer Agent
Specialist agent for customer acquisition, repeat buyers, retention, and VIP profiles.
"""
from __future__ import annotations

from agno.agent import Agent
from app.agents.factory import get_llm_model
from app.llm.provider import BaseLLMProvider
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.tools.customer_tools import CustomerTools
from app.tools.recommendation_tools import RecommendationTools


def build_customer_agent(provider: BaseLLMProvider | None = None) -> Agent:
    """Build and return the Customer specialist agent."""
    return Agent(
        name="Customer Agent",
        role="Expert in customer acquisition, repeat purchase behavior, buyer retention, and VIP customer profiling.",
        model=get_llm_model(provider),
        tools=[CustomerTools(), RecommendationTools()],
        instructions=[
            SYSTEM_PROMPT,
            "You specialize in customer analytics: acquisition, repeat buyers, retention rate, inactive users, and top spenders.",
            "Always call get_customer_acquisition_summary or get_all_customer_metrics first to gather live customer data.",
            "Identify top customer spenders and repeat customer proportions.",
            "Call generate_customer_recommendations to offer targeted retention and VIP reward strategies.",
            "Format values nicely in INR (₹) and percentages.",
        ],
        markdown=False,
        debug_mode=False,
    )
