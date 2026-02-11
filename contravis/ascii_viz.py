"""ASCII state renderer for debugging and LLM context."""

from __future__ import annotations

from .types import DancerID, DancerState, WorldState


FACING_ARROWS = {
    0: "^",    # north/up
    90: ">",   # east
    180: "v",  # south/down
    270: "<",  # west
}


def _facing_arrow(facing: float) -> str:
    """Get the closest arrow for a facing direction."""
    snapped = round(facing / 45) * 45 % 360
    return {
        0: "^", 45: "/", 90: ">", 135: "\\",
        180: "v", 225: "/", 270: "<", 315: "\\",
    }.get(snapped, "?")


def _dancer_label(did: DancerID) -> str:
    """Short label for a dancer: UL, UR, DL, DR."""
    d = "U" if did.is_up else "D"
    r = "L" if did.is_lark else "R"
    return d + r


def render_state(state: WorldState, width: int = 40, height: int = 20) -> str:
    """Render the world state as ASCII art.

    Returns a string showing dancers on a grid with facing arrows.
    The grid spans x=[-1.5, 1.5] and y=[-1.5, 1.5].
    """
    x_min, x_max = -1.5, 1.5
    y_min, y_max = -1.5, 1.5

    grid = [[" " for _ in range(width)] for _ in range(height)]

    # Draw center lines
    center_col = width // 2
    center_row = height // 2
    for r in range(height):
        grid[r][center_col] = "·"
    for c in range(width):
        grid[center_row][c] = "·"

    # Place dancers
    for did, ds in state.dancers.items():
        col = int((ds.x - x_min) / (x_max - x_min) * (width - 1))
        row = int((y_max - ds.y) / (y_max - y_min) * (height - 1))  # y-axis inverted
        col = max(0, min(width - 1, col))
        row = max(0, min(height - 1, row))

        label = _dancer_label(did)
        arrow = _facing_arrow(ds.facing)
        marker = f"{label}{arrow}"

        # Place marker (3 chars)
        for i, ch in enumerate(marker):
            c = col + i - 1
            if 0 <= c < width:
                grid[row][c] = ch

    lines = ["".join(row) for row in grid]

    header = f"Beat {state.beat:.1f}"
    sep = "─" * width
    return f"{header}\n{sep}\n" + "\n".join(lines) + f"\n{sep}"


def render_state_compact(state: WorldState) -> str:
    """Compact text representation of the world state."""
    lines = [f"Beat {state.beat:.1f}:"]
    for did in DancerID:
        ds = state.dancers[did]
        arrow = _facing_arrow(ds.facing)
        lines.append(
            f"  {did.value:12s}: ({ds.x:+.2f}, {ds.y:+.2f}) {arrow} "
            f"facing={ds.facing:.0f}°"
        )
    if state.hands:
        hand_strs = []
        for hc in state.hands:
            hand_strs.append(
                f"{hc.dancer_a.value}.{hc.hand_a.value}-"
                f"{hc.dancer_b.value}.{hc.hand_b.value}"
            )
        lines.append(f"  hands: {', '.join(hand_strs)}")
    return "\n".join(lines)
