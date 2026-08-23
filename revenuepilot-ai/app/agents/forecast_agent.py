"""
RevenuePilot AI — Forecast Agent
Specialist agent for revenue forecasting and predictive trend analysis.
"""
from __future__ import annotations

from agno.agent import Agent
from app.agents.factory import get_llm_model
from app.llm.provider import BaseLLMProvider
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.tools.forecast_tools import ForecastTools
from app.tools.recommendation_tools import RecommendationTools


def build_forecast_agent(provider: BaseLLMProvider | None = None) -> Agent:
    """Build and return the Forecast specialist agent."""
    return Agent(
        name="Forecast Agent",
        role="Expert in revenue forecasting, predictive trajectory analysis, and seasonal sales outlooks.",
        model=get_llm_model(provider),
        tools=[ForecastTools(), RecommendationTools()],
        instructions=[
            SYSTEM_PROMPT,
            "You specialize in revenue forecasting: predicting tomorrow, next week, and next month sales performance.",
            "Always call get_revenue_forecast first to fetch data-driven predictions based on recent order trajectory.",
            "Provide realistic confidence intervals and explain key underlying drivers.",
            "Call generate_revenue_recommendations to suggest actions to reach or exceed forecasted goals.",
            "Always express predicted currency in INR using the ₹ symbol.",
        ],
        markdown=False,
        debug_mode=False,
    )
