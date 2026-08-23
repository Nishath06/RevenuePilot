"""
RevenuePilot AI — LLM Provider Factory
Instantiates and manages active LLM provider based on environment settings.
Supports Gemini, Grok, and OpenAI providers.
"""
from __future__ import annotations

from typing import Optional
from app.core.config import settings
from app.core.logging import get_logger
from app.llm.gemini_provider import GeminiProvider
from app.llm.grok_provider import GrokProvider
from app.llm.openai_provider import OpenAIProvider
from app.llm.provider import BaseLLMProvider

logger = get_logger(__name__)


class LLMFactory:
    """Factory for instantiating the configured LLM provider."""

    _cached_provider: Optional[BaseLLMProvider] = None

    @classmethod
    def get_provider(cls, force_reload: bool = False) -> BaseLLMProvider:
        """
        Returns the active LLM provider based on LLM_PROVIDER or AI_PROVIDER setting.
        Supports gemini, grok, and openai.
        """
        if cls._cached_provider is not None and not force_reload:
            return cls._cached_provider

        provider_name = (settings.LLM_PROVIDER or settings.AI_PROVIDER or "gemini").lower().strip()

        logger.info("Initializing LLM Provider from factory", configured_provider=provider_name)

        if provider_name == "gemini":
            provider = GeminiProvider()
        elif provider_name == "grok":
            provider = GrokProvider()
        elif provider_name == "openai":
            provider = OpenAIProvider()
        else:
            if settings.GEMINI_API_KEY.strip():
                logger.info("Defaulting to Gemini Provider based on available API key")
                provider = GeminiProvider()
            elif settings.GROK_API_KEY.strip():
                logger.info("Defaulting to Grok Provider based on available API key")
                provider = GrokProvider()
            elif settings.OPENAI_API_KEY.strip():
                logger.info("Defaulting to OpenAI Provider based on available API key")
                provider = OpenAIProvider()
            else:
                logger.warning("No valid API key found for Gemini, Grok, or OpenAI providers.")
                raise ValueError(
                    f"Configuration Error: Unsupported or unconfigured LLM provider '{provider_name}'. "
                    "Ensure GEMINI_API_KEY, GROK_API_KEY, or OPENAI_API_KEY is configured in .env."
                )

        cls._cached_provider = provider
        return provider


def get_llm_provider() -> BaseLLMProvider:
    """FastAPI Dependency for retrieving active LLM provider."""
    return LLMFactory.get_provider()
