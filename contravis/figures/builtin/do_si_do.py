"""Do si do: two dancers circle each other without changing facing."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult
from ...interpolation import circular_arc
from ...world import midpoint


@figure("do_si_do", aliases=["dosido", "do_si_do_once"])
def do_si_do(ctx: FigureContext) -> FigureResult:
    """Do si do: dancers walk clockwise around each other, maintaining
    their original facing direction (pass right shoulders, then back left).

    Params:
        turns: number of full circles (default 1.0; 1.5 = do si do 1 1/2)
    """
    state = ctx.start_state
    participants = ctx.participants

    if len(participants) != 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Do si do needs 2 participants, got {len(participants)}"],
        )

    d1, d2 = participants
    turns = ctx.params.get("turns", 1.0)
    total_angle = turns * 360.0  # clockwise

    ds1, ds2 = state.dancers[d1], state.dancers[d2]
    center = midpoint(ds1, ds2)

    keyframes = circular_arc(
        state, [d1, d2], center, total_angle,
        ctx.beat_start, ctx.beat_end, ctx.beats_per_frame,
        face_center=False,  # maintain original facing
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    if keyframes:
        for did in [d1, d2]:
            end_state.dancers[did] = keyframes[-1].dancers[did].copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)
