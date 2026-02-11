"""Inner LLM: resolves ambiguity and generates new figure code."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

from ..ascii_viz import render_state_compact
from ..types import FigureCall, WorldState
from .client import complete
from .prompts import INNER_RESOLVE_SYSTEM, INNER_GENERATE_SYSTEM


def resolve_end_state(
    current_state: WorldState,
    current_figure: FigureCall,
    next_figure: FigureCall | None,
    model: str | None = None,
) -> dict:
    """Ask the LLM to determine the ending state of a figure.

    Returns dict with 'target_facing' and 'reasoning'.
    """
    state_text = render_state_compact(current_state)

    user_msg = f"""Current state:
{state_text}

Current figure: {current_figure.name} (beats {current_figure.beat_start}-{current_figure.beat_end})
  Raw text: {current_figure.raw_text}
  Participants: {current_figure.participants}
  Params: {current_figure.params}

Next figure: {next_figure.name if next_figure else 'none'}
  Raw text: {next_figure.raw_text if next_figure else 'n/a'}

What facing direction should the dancers end in after {current_figure.name}?"""

    response = complete(
        system=INNER_RESOLVE_SYSTEM,
        user=user_msg,
        model=model,
    )

    # Parse JSON from response
    json_text = response.strip()
    if json_text.startswith("```"):
        lines = json_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        json_text = "\n".join(lines)

    return json.loads(json_text)


def generate_figure_code(
    figure_name: str,
    description: str,
    example_code: str,
    model: str | None = None,
    max_retries: int = 2,
) -> str | None:
    """Ask the LLM to generate Python code for a new figure.

    Args:
        figure_name: Name of the figure to implement.
        description: Natural language description.
        example_code: Source code of 2-3 similar builtin figures.
        model: Override LLM model.
        max_retries: Max retries on failure.

    Returns:
        Python source code string, or None on failure.
    """
    user_msg = f"""Implement the figure "{figure_name}".

Description: {description}

Here are example figure implementations for reference:

{example_code}

Write a complete Python module implementing the @figure("{figure_name}") function."""

    for attempt in range(max_retries + 1):
        response = complete(
            system=INNER_GENERATE_SYSTEM,
            user=user_msg,
            model=model,
            max_tokens=4096,
        )

        code = response.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            code = "\n".join(lines)

        # Validate: must parse as valid Python
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            user_msg = f"""The previous code had a syntax error: {e}

Please fix and try again. Respond with ONLY the corrected Python code."""
            continue

        # Validate: must not import anything dangerous
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name not in ("math", "copy"):
                        user_msg = f"""The code imports '{alias.name}' which is not allowed.
Only import from: ..base, ...types, ...interpolation, math, copy.

Please fix and try again."""
                        continue

        # Validate: must contain @figure decorator
        if f'@figure("{figure_name}"' not in code and f"@figure('{figure_name}'" not in code:
            user_msg = f"""The code must use @figure("{figure_name}") decorator.

Please fix and try again."""
            continue

        return code

    return None


def save_generated_figure(figure_name: str, code: str) -> Path:
    """Save generated figure code to the generated/ directory."""
    gen_dir = Path(__file__).parent.parent / "figures" / "generated"
    gen_dir.mkdir(parents=True, exist_ok=True)
    path = gen_dir / f"{figure_name}.py"
    path.write_text(code)
    return path
