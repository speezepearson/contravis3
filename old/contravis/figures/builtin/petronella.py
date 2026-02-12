"""Petronella: each dancer steps to the position on their right, spinning 270° CW."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult
from ...interpolation import linear


@figure("petronella")
def petronella(ctx: FigureContext) -> FigureResult:
    """Petronella: 4 beats. Typically after "take hands in a ring, balance."

    Each dancer notes where the person on their right is standing, steps
    into that place, rotating 270° clockwise so they still face the center
    of the ring.

    Expects 4 participants arranged roughly in a ring.
    """
    state = ctx.start_state
    participants = ctx.participants

    if len(participants) != 4:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Petronella needs 4 participants, got {len(participants)}"],
        )

    # Sort participants by their angle from center (to determine ring order)
    xs = [state.dancers[d].x for d in participants]
    ys = [state.dancers[d].y for d in participants]
    cx, cy = sum(xs) / 4, sum(ys) / 4

    def angle_key(d: DancerID) -> float:
        ds = state.dancers[d]
        return math.atan2(ds.x - cx, ds.y - cy)

    ring = sorted(participants, key=angle_key)

    # Each dancer moves to the next position clockwise (the person on their right)
    targets: dict[DancerID, DancerState] = {}
    for i, d in enumerate(ring):
        next_d = ring[(i + 1) % 4]
        ds_next = state.dancers[next_d]
        ds_curr = state.dancers[d]
        # End facing: rotate 270° CW from current facing
        new_facing = (ds_curr.facing + 270) % 360
        targets[d] = DancerState(x=ds_next.x, y=ds_next.y, facing=new_facing)

    keyframes = linear(
        state, targets,
        ctx.beat_start, ctx.beat_end, ctx.beats_per_frame,
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    for d, t in targets.items():
        end_state.dancers[d] = t.copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)
