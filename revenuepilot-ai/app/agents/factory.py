"""
RevenuePilot AI — Agent Model Helper
Returns Agno model instance from active LLM provider.
"""
from __future__ import annotations

from agno.models.openai import OpenAIChat
from app.llm import LLMFactory, BaseLLMProvider


def get_llm_model(provider: BaseLLMProvider | None = None) -> OpenAIChat:
    """
    Returns configured Agno model from injected provider or LLMFactory.
    """
    active_provider = provider or LLMFactory.get_provider()
    return active_provider.get_agno_model()
