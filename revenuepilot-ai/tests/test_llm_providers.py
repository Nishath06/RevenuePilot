"""
RevenuePilot AI — LLM Provider Routing & Health Tests
Verifies provider abstraction layer, factory routing, health metadata, and fallback handling.
"""
import pytest
from app.core.config import settings
from app.llm import LLMFactory, BaseLLMProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.grok_provider import GrokProvider
from app.llm.openai_provider import OpenAIProvider
from app.api.health import health


@pytest.mark.asyncio
async def test_gemini_provider_factory_routing():
    """Verify LLMFactory initializes GeminiProvider when LLM_PROVIDER=gemini."""
    settings.LLM_PROVIDER = "gemini"
    settings.GEMINI_API_KEY = "test_gemini_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, GeminiProvider)
    assert provider.name == "gemini"
    assert provider.model == "gemini-3.6-flash"


@pytest.mark.asyncio
async def test_grok_provider_factory_routing():
    """Verify LLMFactory initializes GrokProvider when LLM_PROVIDER=grok."""
    settings.LLM_PROVIDER = "grok"
    settings.GROK_API_KEY = "test_grok_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, GrokProvider)
    assert provider.name == "grok"
    assert provider.model is not None


@pytest.mark.asyncio
async def test_openai_provider_factory_routing():
    """Verify LLMFactory initializes OpenAIProvider when LLM_PROVIDER=openai."""
    settings.LLM_PROVIDER = "openai"
    settings.OPENAI_API_KEY = "test_openai_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, OpenAIProvider)
    assert provider.name == "openai"
    assert provider.model == settings.OPENAI_MODEL


@pytest.mark.asyncio
async def test_health_endpoint_metadata():
    """Verify GET /health returns llm_provider, llm_status, and analytics_engine."""
    res = await health()
    assert res.status in ["healthy", "degraded"]
    assert res.mongodb in ["connected", "disconnected"]
    assert res.llm_provider in ["gemini", "grok", "openai"]
    assert res.llm_status in ["connected", "degraded"]
    assert res.analytics_engine == "ready"
