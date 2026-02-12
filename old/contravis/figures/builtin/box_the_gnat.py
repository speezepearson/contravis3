"""Box the gnat: lark and robin swap places over right hands."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection
from ...interpolation import circular_arc
from ...world import midpoint


@figure("box_the_gnat")
def box_the_gnat(ctx: FigureContext) -> FigureResult:
    """Box the gnat: 4 beats. Lark and robin hold right hands and trade
    places — lark turns clockwise, robin counter-clockwise. Effectively
    a half-orbit around their midpoint.

    In practice this is similar to allemande right 1/2 but the dancers
    end facing each other (they don't maintain center-facing).
    """
    state = ctx.start_state
    participants = ctx.participants

    if len(participants) != 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Box the gnat needs 2 participants, got {len(participants)}"],
        )

    d1, d2 = participants
    ds1, ds2 = state.dancers[d1], state.dancers[d2]
    center = midpoint(ds1, ds2)

    # Half orbit clockwise (180°)
    hands = [HandConnection(d1, Hand.RIGHT, d2, Hand.RIGHT)]
    keyframes = circular_arc(
        state, [d1, d2], center, 180.0,
        ctx.beat_start, ctx.beat_end, ctx.beats_per_frame,
        hands=hands, face_center=True,
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    if keyframes:
        for did in [d1, d2]:
            end_state.dancers[did] = keyframes[-1].dancers[did].copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)
