"""
RevenuePilot AI — Revenue Agent
Specialist agent for all revenue-related questions.
"""
from __future__ import annotations

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from app.core.config import settings
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.tools.recommendation_tools import RecommendationTools
from app.tools.revenue_tools import RevenueTools


def build_revenue_agent() -> Agent:
    """Build and return the Revenue specialist agent."""
    return Agent(
        name="Revenue Agent",
        role="Expert in revenue analysis, growth trends, and sales performance metrics.",
        model=OpenAIChat(id=settings.OPENAI_MODEL, api_key=settings.OPENAI_API_KEY),
        tools=[RevenueTools(), RecommendationTools()],
        instructions=[
            SYSTEM_PROMPT,
            "You specialize in revenue metrics: daily, weekly, monthly revenue, growth rates, and average order value.",
            "Always call get_all_revenue_metrics first to get the full picture.",
            "Then call generate_revenue_recommendations to provide actionable next steps.",
            "Always express currency in INR using the ₹ symbol.",
        ],
        markdown=False,
        debug_mode=False,
    )
