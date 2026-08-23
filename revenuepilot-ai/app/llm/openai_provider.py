"""
RevenuePilot AI — OpenAI LLM Provider Implementation
Encapsulates OpenAI API integration inside provider class.
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


class OpenAIProvider(BaseLLMProvider):
    """
    OpenAI LLM Provider implementation.
    Initializes OpenAI provider only when explicit OpenAI provider selected.
    """

    def __init__(self) -> None:
        api_key = (settings.OPENAI_API_KEY or "").strip()
        if not api_key:
            logger.warning("OPENAI_API_KEY is not set or empty. OpenAI Provider initialization required key.")
            raise ValueError("Configuration Error: OPENAI_API_KEY is missing in environment.")

        model = settings.OPENAI_MODEL or "gpt-4o-mini"
        super().__init__(name="openai", model=model)
        self.api_key = api_key

    def get_agno_model(self) -> OpenAIChat:
        """Return Agno OpenAIChat model wrapper initialized for OpenAI."""
        return OpenAIChat(
            id=self.model,
            api_key=self.api_key,
        )

    async def generate(self, messages: list[dict[str, str]] | str, **kwargs: Any) -> str:
        """
        Send async Chat Completions request to OpenAI API.
        Logs structlog performance telemetry.
        """
        start = time.perf_counter()

        if isinstance(messages, str):
            payload_messages = [{"role": "user", "content": messages}]
        else:
            payload_messages = messages

        temperature = kwargs.get("temperature", 0.7)
        max_tokens = kwargs.get("max_tokens", 1024)

        url = "https://api.openai.com/v1/chat/completions"
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
            "OpenAI LLM generation completed",
            provider="openai",
            model=self.model,
            latency_ms=latency_ms,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            fallback_used=False,
        )

        content = data["choices"][0]["message"]["content"]
        return content
