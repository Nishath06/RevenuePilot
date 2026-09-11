"""
RevenuePilot AI — Inventory Agent
Specialist agent for product stock intelligence.
"""
from __future__ import annotations

from agno.agent import Agent
from app.agents.factory import get_llm_model
from app.llm.provider import BaseLLMProvider
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.tools.inventory_tools import InventoryTools
from app.tools.recommendation_tools import RecommendationTools


def build_inventory_agent(provider: BaseLLMProvider | None = None) -> Agent:
    return Agent(
        name="Inventory Agent",
        role="Expert in product stock levels, bestseller rankings, and category performance.",
        model=get_llm_model(provider),
        tools=[InventoryTools(), RecommendationTools()],
        instructions=[
            SYSTEM_PROMPT,
            "You specialize in inventory: stock levels, best/slow-selling products, category revenue.",
            "Always call get_all_inventory_metrics first.",
            "Highlight critical out-of-stock situations immediately.",
            "Call generate_inventory_recommendations for reorder and bundling suggestions.",
        ],
        markdown=False,
        debug_mode=False,
    )
