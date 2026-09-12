"""
RevenuePilot AI — LLM Provider Routing & Health Tests
Verifies provider abstraction layer, factory routing, health metadata, and fallback handling.

All LLM provider imports are lazy (inside test bodies) so `pytest -m unit` never
initialises any LLM SDK during collection.
"""
import pytest

# Provider routing tests are pure unit tests (no real API calls made)
pytestmark = [pytest.mark.unit]


@pytest.mark.asyncio
async def test_gemini_provider_factory_routing():
    """Verify LLMFactory initializes GeminiProvider when LLM_PROVIDER=gemini."""
    from app.core.config import settings
    from app.llm import LLMFactory
    from app.llm.gemini_provider import GeminiProvider

    settings.LLM_PROVIDER = "gemini"
    settings.GEMINI_API_KEY = "test_gemini_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, GeminiProvider)
    assert provider.name == "gemini"
    assert provider.model == "gemini-3.6-flash"


@pytest.mark.asyncio
async def test_grok_provider_factory_routing():
    """Verify LLMFactory initializes GrokProvider when LLM_PROVIDER=grok."""
    from app.core.config import settings
    from app.llm import LLMFactory
    from app.llm.grok_provider import GrokProvider

    settings.LLM_PROVIDER = "grok"
    settings.GROK_API_KEY = "test_grok_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, GrokProvider)
    assert provider.name == "grok"
    assert provider.model is not None


@pytest.mark.asyncio
async def test_openai_provider_factory_routing():
    """Verify LLMFactory initializes OpenAIProvider when LLM_PROVIDER=openai."""
    from app.core.config import settings
    from app.llm import LLMFactory
    from app.llm.openai_provider import OpenAIProvider

    settings.LLM_PROVIDER = "openai"
    settings.OPENAI_API_KEY = "test_openai_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, OpenAIProvider)
    assert provider.name == "openai"
    assert provider.model == settings.OPENAI_MODEL


@pytest.mark.integration
@pytest.mark.llm
@pytest.mark.asyncio
async def test_health_endpoint_metadata():
    """Verify GET /health returns llm_provider, llm_status, and analytics_engine."""
    from app.api.health import health
    res = await health()
    assert res.status in ["healthy", "degraded"]
    assert res.mongodb in ["connected", "disconnected"]
    assert res.llm_provider in ["gemini", "grok", "openai"]
    assert res.llm_status in ["connected", "degraded"]
    assert res.analytics_engine == "ready"

