from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from openai import OpenAI


@dataclass(frozen=True)
class LlmConfig:
    provider: str  # "openai" | "groq"
    api_key: str
    base_url: Optional[str]
    model: str


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def get_llm_config() -> Optional[LlmConfig]:
    """
    Returns:
        LlmConfig if a provider is configured, else None.
    """
    provider = (os.getenv("LLM_PROVIDER") or "auto").strip().lower()
    groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()

    if provider in {"auto", ""}:
        if groq_key:
            provider = "groq"
        elif openai_key:
            provider = "openai"
        else:
            return None

    if provider == "groq":
        if not groq_key:
            return None
        model = (os.getenv("GROQ_MODEL") or os.getenv("LLM_MODEL") or "llama-3.1-70b-versatile").strip()
        return LlmConfig(
            provider="groq",
            api_key=groq_key,
            base_url=(os.getenv("GROQ_BASE_URL") or "https://api.groq.com/openai/v1").strip(),
            model=model,
        )

    if provider == "openai":
        if not openai_key:
            return None
        model = (os.getenv("OPENAI_MODEL") or os.getenv("LLM_MODEL") or "gpt-4o-mini").strip()
        return LlmConfig(
            provider="openai",
            api_key=openai_key,
            base_url=(os.getenv("OPENAI_BASE_URL") or "").strip() or None,
            model=model,
        )

    return None


def _extract_first_json_object(text: str) -> Dict[str, Any]:
    """
    Attempts to parse a JSON object from a model response.
    Accepts either a raw JSON object or a response containing one.
    """
    text = text.strip()
    if not text:
        raise ValueError("Empty model response")

    # Fast path: the entire response is JSON.
    try:
        value = json.loads(text)
        if isinstance(value, dict):
            return value
    except Exception:
        pass

    # Fallback: pull the first {...} block. This is robust against models adding prose.
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON object found in response")

    value = json.loads(match.group(0))
    if not isinstance(value, dict):
        raise ValueError("Parsed JSON was not an object")
    return value


def chat_json(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.2,
    max_tokens: int = 1200,
) -> Dict[str, Any]:
    """
    Sends a chat completion request and returns a parsed JSON object.

    Notes:
      - Uses the OpenAI Python SDK against either OpenAI or Groq's OpenAI-compatible API.
      - Returns only a JSON object; raises if none can be parsed.
    """
    config = get_llm_config()
    if not config:
        raise RuntimeError("No LLM provider configured (set GROQ_API_KEY or OPENAI_API_KEY)")

    client = OpenAI(api_key=config.api_key, base_url=config.base_url)

    # Groq currently supports the OpenAI Chat Completions API shape.
    use_json_mode = (os.getenv("LLM_JSON_MODE") or "on").strip().lower() not in {"0", "false", "no", "off"}

    def _create_completion(response_format: Optional[Dict[str, str]]):
        kwargs: Dict[str, Any] = {
            "model": config.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": float(os.getenv("LLM_TOP_P", "1") or "1"),
        }
        if response_format:
            kwargs["response_format"] = response_format
        return client.chat.completions.create(**kwargs)

    try:
        response = _create_completion({"type": "json_object"} if use_json_mode else None)
    except Exception as e:
        message = str(e)
        if use_json_mode and ("json_validate_failed" in message or "Failed to validate JSON" in message):
            response = _create_completion(None)
        else:
            raise

    content = (response.choices[0].message.content or "").strip()
    return _extract_first_json_object(content)


def llm_enabled() -> bool:
    return get_llm_config() is not None


def allow_network_pdf_fetch() -> bool:
    # Lets you disable PDF downloads in environments where outbound fetch is undesired.
    return _env_bool("ENRICH_FETCH_PDFS", True)
