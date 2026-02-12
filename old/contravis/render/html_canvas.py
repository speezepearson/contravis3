"""Self-contained HTML+JS+Canvas animation renderer."""

from __future__ import annotations

import json
from pathlib import Path

from ..types import DancerID, Keyframe


def keyframes_to_json(keyframes: list[Keyframe]) -> str:
    """Convert keyframes to JSON for embedding in HTML."""
    frames = []
    for kf in keyframes:
        dancers = {}
        for did, ds in kf.dancers.items():
            dancers[did.value] = {
                "x": round(ds.x, 4),
                "y": round(ds.y, 4),
                "facing": round(ds.facing, 2),
            }
        hands = []
        for hc in kf.hands:
            hands.append({
                "a": hc.dancer_a.value,
                "ha": hc.hand_a.value,
                "b": hc.dancer_b.value,
                "hb": hc.hand_b.value,
            })
        frames.append({
            "beat": round(kf.beat, 3),
            "dancers": dancers,
            "hands": hands,
            "annotation": kf.annotation,
        })
    return json.dumps(frames)


def _load_template() -> str:
    return (Path(__file__).parent / "template.html").read_text()



def render_html(
    keyframes: list[Keyframe],
    output_path: str | Path,
    title: str = "Contra Dance",
    progression_rate: float = -1.0 / 64,
) -> Path:
    """Render keyframes to a self-contained HTML file.

    Args:
        keyframes: List of animation keyframes.
        output_path: Where to write the HTML file.
        title: Dance title shown in the header.
        progression_rate: Camera pan speed in meters/beat. Negative = south.
            Default: -1/64 (single progression, tracking "down" dancers).

    Returns:
        Path to the written HTML file.
    """
    output_path = Path(output_path)
    kf_json = keyframes_to_json(keyframes)
    html = _load_template().replace("%%KEYFRAMES_JSON%%", kf_json)
    html = html.replace("%%DANCE_TITLE%%", title)
    html = html.replace("%%PROGRESSION_RATE%%", str(progression_rate))
    output_path.write_text(html)
    return output_path
