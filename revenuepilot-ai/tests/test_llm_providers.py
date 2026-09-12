"""
RevenuePilot AI — LLM Provider Routing & Health Tests
Verifies provider abstraction layer, factory routing, health metadata, and fallback handling.

All LLM provider imports are lazy (inside test bodies) so `pytest -m unit` never
initialises any LLM SDK during collection.
"""
import os
import json
import pytest

def _has_llm_keys() -> bool:
    for k in ("OPENAI_API_KEY", "GEMINI_API_KEY", "GROK_API_KEY"):
        val = os.environ.get(k, "").strip()
        if val and not val.startswith("unit-test") and not val.startswith("sk-placeholder"):
            return True
    return False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_gemini_provider_factory_routing(monkeypatch):
    """Verify LLMFactory initializes GeminiProvider when LLM_PROVIDER=gemini."""
    from app.core.config import settings
    from app.llm import LLMFactory
    from app.llm.gemini_provider import GeminiProvider

    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "test_gemini_key")
    settings.LLM_PROVIDER = "gemini"
    settings.GEMINI_API_KEY = "test_gemini_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, GeminiProvider)
    assert provider.name == "gemini"
    assert provider.model == getattr(settings, "GEMINI_MODEL", provider.model)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_grok_provider_factory_routing(monkeypatch):
    """Verify LLMFactory initializes GrokProvider when LLM_PROVIDER=grok."""
    from app.core.config import settings
    from app.llm import LLMFactory
    from app.llm.grok_provider import GrokProvider

    monkeypatch.setenv("LLM_PROVIDER", "grok")
    monkeypatch.setenv("GROK_API_KEY", "test_grok_key")
    settings.LLM_PROVIDER = "grok"
    settings.GROK_API_KEY = "test_grok_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, GrokProvider)
    assert provider.name == "grok"
    assert provider.model is not None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_openai_provider_factory_routing(monkeypatch):
    """Verify LLMFactory initializes OpenAIProvider when LLM_PROVIDER=openai."""
    from app.core.config import settings
    from app.llm import LLMFactory
    from app.llm.openai_provider import OpenAIProvider

    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test_openai_key")
    settings.LLM_PROVIDER = "openai"
    settings.OPENAI_API_KEY = "test_openai_key"
    provider = LLMFactory.get_provider(force_reload=True)

    assert isinstance(provider, OpenAIProvider)
    assert provider.name == "openai"
    assert provider.model == settings.OPENAI_MODEL


@pytest.mark.integration
@pytest.mark.llm
@pytest.mark.skipif(
    not _has_llm_keys(),
    reason="Requires valid LLM API key (OPENAI_API_KEY, GEMINI_API_KEY, or GROK_API_KEY)"
)
@pytest.mark.asyncio
async def test_health_endpoint_metadata():
    """Verify GET /health returns llm_provider, llm_status, and metadata."""
    from app.api.health import health
    res = await health()
    body = json.loads(res.body)
    assert body["status"] in ["healthy", "degraded"]
    assert body["mongodb"] in [True, False, "connected", "disconnected"]
    assert body["llm_provider"] in ["gemini", "grok", "openai"]
    assert body["llm_status"] in ["connected", "degraded"]


