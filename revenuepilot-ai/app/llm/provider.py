"""
RevenuePilot AI — Base LLM Provider Abstraction
Defines abstract interface for all LLM providers (Grok, OpenAI, etc.).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from agno.models.openai import OpenAIChat


class BaseLLMProvider(ABC):
    """Abstract base class for LLM Providers."""

    def __init__(self, name: str, model: str) -> None:
        self.name = name
        self.model = model

    @abstractmethod
    async def generate(self, messages: list[dict[str, str]] | str, **kwargs: Any) -> str:
        """Generate normalized response text from LLM given prompt or messages."""
        pass

    @abstractmethod
    def get_agno_model(self) -> OpenAIChat:
        """Return Agno OpenAIChat model instance configured for this provider."""
        pass
