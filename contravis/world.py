"""Formation factories, relationship resolution, and formation snapping."""

from __future__ import annotations

import math

from .types import DancerID, DancerState, Formation, HandConnection, WorldState


def make_formation(formation: Formation, beat: float = 0.0) -> WorldState:
    """Create a WorldState with dancers in the given starting formation."""
    if formation == Formation.IMPROPER:
        return _improper(beat)
    elif formation == Formation.BECKETT:
        return _beckett(beat)
    raise ValueError(f"Unknown formation: {formation}")


def _improper(beat: float) -> WorldState:
    """Improper formation: hands-four centered at y=0.
    Down dancers at y=+0.5, up dancers at y=-0.5.
    Down dancers face 180° (south), up dancers face 0° (north).
    West line x=-0.5, east line x=+0.5.
    Larks on left of pair (west when facing north, east when facing south).
    """
    return WorldState(
        beat=beat,
        dancers={
            DancerID.DOWN_LARK: DancerState(x=0.5, y=0.5, facing=180.0),
            DancerID.DOWN_ROBIN: DancerState(x=-0.5, y=0.5, facing=180.0),
            DancerID.UP_ROBIN: DancerState(x=0.5, y=-0.5, facing=0.0),
            DancerID.UP_LARK: DancerState(x=-0.5, y=-0.5, facing=0.0),
        },
    )


def _beckett(beat: float) -> WorldState:
    """Beckett formation: improper rotated 90° clockwise.
    Everyone faces across the set."""
    return WorldState(
        beat=beat,
        dancers={
            DancerID.DOWN_LARK: DancerState(x=-0.5, y=0.5, facing=90.0),
            DancerID.DOWN_ROBIN: DancerState(x=-0.5, y=-0.5, facing=90.0),
            DancerID.UP_ROBIN: DancerState(x=0.5, y=0.5, facing=270.0),
            DancerID.UP_LARK: DancerState(x=0.5, y=-0.5, facing=270.0),
        },
    )


def resolve_participants(reference: str, dancer: DancerID) -> DancerID:
    """Resolve a relationship reference to a concrete DancerID.

    E.g. resolve_participants("neighbor", DancerID.UP_LARK) → DancerID.DOWN_ROBIN
    """
    ref = reference.lower().strip()
    if ref in ("partner", "partners"):
        return dancer.partner
    elif ref in ("neighbor", "neighbors"):
        return dancer.neighbor
    elif ref in ("opposite", "opposites"):
        return dancer.opposite
    raise ValueError(f"Unknown relationship: {reference}")


def resolve_participant_group(reference: str) -> list[tuple[DancerID, DancerID]]:
    """Resolve a relationship reference to pairs of concrete DancerIDs.

    Returns pairs where each dancer interacts with the named relation.
    For 'neighbors': [(UP_LARK, DOWN_ROBIN), (UP_ROBIN, DOWN_LARK)]
    """
    ref = reference.lower().strip()
    if ref in ("partner", "partners"):
        return [
            (DancerID.UP_LARK, DancerID.UP_ROBIN),
            (DancerID.DOWN_LARK, DancerID.DOWN_ROBIN),
        ]
    elif ref in ("neighbor", "neighbors"):
        return [
            (DancerID.UP_LARK, DancerID.DOWN_ROBIN),
            (DancerID.UP_ROBIN, DancerID.DOWN_LARK),
        ]
    elif ref in ("opposite", "opposites"):
        return [
            (DancerID.UP_LARK, DancerID.DOWN_LARK),
            (DancerID.UP_ROBIN, DancerID.DOWN_ROBIN),
        ]
    elif ref in ("lark", "larks", "gentlespoons"):
        return [(DancerID.UP_LARK, DancerID.DOWN_LARK)]
    elif ref in ("robin", "robins", "ladles"):
        return [(DancerID.UP_ROBIN, DancerID.DOWN_ROBIN)]
    raise ValueError(f"Unknown relationship: {reference}")


def normalize_facing(angle: float) -> float:
    """Normalize an angle to [0, 360)."""
    return angle % 360.0


def distance(a: DancerState, b: DancerState) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def midpoint(a: DancerState, b: DancerState) -> tuple[float, float]:
    return ((a.x + b.x) / 2, (a.y + b.y) / 2)


def angle_from_to(a: DancerState, b: DancerState) -> float:
    """Angle in degrees from a to b, 0=north, 90=east."""
    dx = b.x - a.x
    dy = b.y - a.y
    return math.degrees(math.atan2(dx, dy)) % 360.0


