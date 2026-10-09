from __future__ import annotations

import json
import re
from typing import TypeVar

import httpx
from pydantic import BaseModel

from .config import get_settings

T = TypeVar("T", bound=BaseModel)


class LLM:
    """Small provider wrapper for LM Studio's OpenAI-compatible local API."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model_id: str | None = None

    def _model(self) -> str:
        if self._model_id:
            return self._model_id

        configured = self.settings.lm_studio_model.strip()
        if configured and configured.lower() != "auto":
            self._model_id = configured
            return configured

        url = f"{self.settings.lm_studio_url.rstrip('/')}/models"
        with httpx.Client(timeout=self.settings.request_timeout_seconds, trust_env=False) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()

        models = data.get("data", [])
        if not models:
            raise RuntimeError(
                "LM Studio has no loaded model. Open LM Studio, load a small instruct model, "
                "and start the local server on port 1234."
            )

        self._model_id = str(models[0]["id"])
        return self._model_id

    def _chat(self, messages: list[dict[str, str]], *, json_mode: bool = False) -> str:
        url = f"{self.settings.lm_studio_url.rstrip('/')}/chat/completions"
        payload: dict = {
            "model": self._model(),
            "messages": messages,
            "temperature": 0,
            "stream": False,
            "max_tokens": self.settings.lm_studio_max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {"Authorization": f"Bearer {self.settings.lm_studio_api_key}"}
        with httpx.Client(timeout=self.settings.request_timeout_seconds, trust_env=False) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        try:
            return str(data["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Unexpected LM Studio response: {data}") from exc

    def structured(self, schema: type[T], system: str, user: str) -> T:
        """Generate JSON locally and validate it with a Pydantic schema."""
        prompt = (
            f"{system}\n\n"
            "Return ONLY a valid JSON object. Do not use markdown fences. "
            "The JSON must match this schema exactly:\n"
            f"{json.dumps(schema.model_json_schema(), indent=2)}\n\n"
            f"User request:\n{user}"
        )
        messages = [{"role": "system", "content": prompt}]
        try:
            content = self._chat(messages, json_mode=True)
        except httpx.HTTPStatusError:
            # Some local model builds do not implement JSON mode. The strict prompt
            # still gives us a reliable fallback for small instruct models.
            content = self._chat(messages, json_mode=False)
        return schema.model_validate(self._parse_json(content))

    def text(self, system: str, user: str) -> str:
        # Qwen3 can spend the whole local token budget in reasoning mode.
        # Atlas uses an explicit no-think marker for short grounded synthesis.
        return self._chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": f"{user}\n/no_think"},
            ]
        )

    def chat(self, messages: list[dict[str, str]]) -> str:
        """Conversational generation for the Chat mode.

        Qwen3 can spend a local token budget in reasoning mode, so the no-think
        marker is appended only to the latest user turn.
        """
        if not messages:
            raise ValueError("Chat requires at least one message.")

        prepared = [dict(message) for message in messages]
        for index in range(len(prepared) - 1, -1, -1):
            if prepared[index].get("role") == "user":
                prepared[index]["content"] = (
                    f"{prepared[index].get('content', '').strip()}\n/no_think"
                )
                break

        return self._chat(prepared)

    @staticmethod
    def _parse_json(content: str) -> dict:
        cleaned = content.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start >= 0 and end > start:
                return json.loads(cleaned[start : end + 1])
            raise
