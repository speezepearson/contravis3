"""Outer LLM: parses dance text → list of FigureCalls."""

from __future__ import annotations

import json
import re

from ..types import FigureCall, Formation
from .client import complete
from .prompts import OUTER_SYSTEM


def parse_dance(text: str, model: str | None = None) -> tuple[Formation, list[FigureCall]]:
    """Parse a dance description into a formation and list of figure calls.

    Args:
        text: Dance description with beat markers.
        model: Override LLM model.

    Returns:
        (formation, figure_calls)
    """
    # Extract formation from header
    formation = Formation.IMPROPER
    formation_match = re.search(r'\[formation:\s*(\w+)\]', text, re.IGNORECASE)
    if formation_match:
        fname = formation_match.group(1).lower()
        if fname == "beckett":
            formation = Formation.BECKETT
        # else default to improper

    response = complete(
        system=OUTER_SYSTEM,
        user=text,
        model=model,
    )

    # Extract JSON from response (handle potential markdown fencing)
    json_text = response.strip()
    if json_text.startswith("```"):
        # Strip markdown code fences
        lines = json_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        json_text = "\n".join(lines)

    raw_calls = json.loads(json_text)

    calls = []
    for rc in raw_calls:
        calls.append(FigureCall(
            name=rc["name"],
            beat_start=float(rc["beat_start"]),
            beat_end=float(rc["beat_end"]),
            participants=rc.get("participants", []),
            params=rc.get("params", {}),
            raw_text=rc.get("raw_text", ""),
        ))

    return formation, calls
