"""
RevenuePilot AI — Google Gemini LLM Provider Implementation
Uses async HTTP client calling Google Gemini OpenAI-compatible Chat Completions API.
Sanitizes tool schemas to ensure strict Gemini API compatibility.
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


def sanitize_gemini_tools(tools: list[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
    """
    Sanitize Agno OpenAI tool definitions into clean Gemini-compatible JSON schema.
    Strips requires_confirmation, external_execution, approval_type, strict, additionalProperties, $schema.
    """
    if not tools:
        return tools
    clean_tools = []
    for tool in tools:
        if isinstance(tool, dict) and tool.get("type") == "function" and "function" in tool:
            fn = dict(tool["function"])

            # Remove OpenAI-specific metadata
            for key in ["requires_confirmation", "external_execution", "approval_type", "strict"]:
                fn.pop(key, None)

            # Ensure clean JSON schema parameters
            if "parameters" in fn and isinstance(fn["parameters"], dict):
                params = dict(fn["parameters"])
                params.pop("additionalProperties", None)
                params.pop("$schema", None)

                # Clean properties recursively
                if "properties" in params and isinstance(params["properties"], dict):
                    clean_props = {}
                    for prop_name, prop_val in params["properties"].items():
                        if isinstance(prop_val, dict):
                            p = dict(prop_val)
                            p.pop("additionalProperties", None)
                            p.pop("$schema", None)
                            clean_props[prop_name] = p
                        else:
                            clean_props[prop_name] = prop_val
                    params["properties"] = clean_props

                fn["parameters"] = params
            else:
                fn["parameters"] = {"type": "object", "properties": {}, "required": []}

            clean_tools.append({"type": "function", "function": fn})
        else:
            clean_tools.append(tool)
    return clean_tools


class GeminiOpenAIChat(OpenAIChat):
    """OpenAIChat model wrapper that sanitizes tool schemas for Google Gemini API compatibility."""

    def get_request_params(
        self,
        response_format: Any = None,
        tools: Any = None,
        tool_choice: Any = None,
        run_response: Any = None,
    ) -> dict[str, Any]:
        params = super().get_request_params(
            response_format=response_format,
            tools=tools,
            tool_choice=tool_choice,
            run_response=run_response,
        )
        if "tools" in params and params["tools"]:
            params["tools"] = sanitize_gemini_tools(params["tools"])
        return params


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini LLM Provider implementation using async HTTP requests.
    Uses Google's official OpenAI API compatibility endpoint.
    """

    def __init__(self) -> None:
        import os
        api_key = (os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY or "").strip()
        if not api_key:
            logger.warning("GEMINI_API_KEY is not set or empty. Gemini Provider initialization requires key.")
            raise ValueError("Configuration Error: GEMINI_API_KEY is missing in environment.")

        base_url = (os.getenv("GEMINI_BASE_URL") or settings.GEMINI_BASE_URL or "https://generativelanguage.googleapis.com/v1beta/openai").rstrip("/")
        model = os.getenv("GEMINI_MODEL") or settings.GEMINI_MODEL or "gemini-3.5-flash"

        super().__init__(name="gemini", model=model)
        self.api_key = api_key
        self.base_url = base_url

    def get_agno_model(self) -> GeminiOpenAIChat:
        """Return Agno GeminiOpenAIChat model wrapper initialized for Gemini with sanitized tool schemas."""
        return GeminiOpenAIChat(
            id=self.model,
            api_key=self.api_key,
            base_url=f"{self.base_url}/",
        )

    async def generate(self, messages: list[dict[str, str]] | str, **kwargs: Any) -> str:
        """
        Send async Chat Completions request to Gemini API endpoint.
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
            "Gemini LLM generation completed",
            provider="gemini",
            model=self.model,
            latency_ms=latency_ms,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            fallback_used=False,
        )

        content = data["choices"][0]["message"]["content"]
        return content
