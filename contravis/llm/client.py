"""Thin wrapper around the Anthropic SDK."""

from __future__ import annotations

import os
from typing import Any

import anthropic


_default_model = "claude-sonnet-4-20250514"


def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


def complete(
    system: str,
    user: str,
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.0,
) -> str:
    """Send a single prompt and get a text response."""
    client = get_client()
    msg = client.messages.create(
        model=model or _default_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        temperature=temperature,
    )
    return msg.content[0].text
