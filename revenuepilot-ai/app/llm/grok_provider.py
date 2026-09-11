"""
RevenuePilot AI — Grok LLM Provider Implementation
Uses async HTTP client calling Grok / Groq OpenAI-compatible Chat Completions API.
"""
from __future__ import annotations

import time
from typing import Any
import httpx
from agno.models.openai import OpenAIChat

from app.core.config import settings
from app.core.logging import get_logger
from app.llm.provider import BaseLLMProvider

logger = get_logger(__name__)


class GrokProvider(BaseLLMProvider):
    """
    Grok LLM Provider implementation using async HTTP requests.
    Initializes zero OpenAI SDK dependencies.
    """

    def __init__(self) -> None:
        api_key = (settings.GROK_API_KEY or "").strip()
        if not api_key:
            logger.warning("GROK_API_KEY is not set or empty. Grok Provider initialization required key.")
            raise ValueError("Configuration Error: GROK_API_KEY is missing in environment.")

        base_url = (settings.GROK_BASE_URL or "https://api.groq.com/openai/v1").rstrip("/")
        model = settings.GROK_MODEL or "grok-4-fast"

        # Map Groq base URL model if default
        if "groq.com" in base_url and model in ("grok-4-fast", "grok", ""):
            effective_model = "openai/gpt-oss-120b"
        else:
            effective_model = model

        super().__init__(name="grok", model=effective_model)
        self.api_key = api_key
        self.base_url = base_url
        self.raw_model = model

    def get_agno_model(self) -> OpenAIChat:
        """Return Agno OpenAIChat model wrapper initialized for Grok."""
        return OpenAIChat(
            id=self.model,
            api_key=self.api_key,
            base_url=self.base_url,
        )

    async def generate(self, messages: list[dict[str, str]] | str, **kwargs: Any) -> str:
        """
        Send async Chat Completions request to Grok API endpoint.
        Logs structlog performance telemetry.
        """
        start = time.perf_counter()

        if isinstance(messages, str):
            payload_messages = [{"role": "user", "content": messages}]
        else:
            payload_messages = messages

        temperature = kwargs.get("temperature", 0.7)
        max_tokens = kwargs.get("max_tokens", 1024)

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        body = {
            "model": self.model,
            "messages": payload_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, headers=headers, json=body)
            res.raise_for_status()
            data = res.json()

        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        usage = data.get("usage", {})
        tokens_in = usage.get("prompt_tokens", 0)
        tokens_out = usage.get("completion_tokens", 0)

        logger.info(
            "Grok LLM generation completed",
            provider="grok",
            model=self.model,
            latency_ms=latency_ms,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            fallback_used=False,
        )

        content = data["choices"][0]["message"]["content"]
        return content
