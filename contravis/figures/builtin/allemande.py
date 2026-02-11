"""Allemande: two dancers orbit around their midpoint."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection
from ...interpolation import circular_arc
from ...world import midpoint


def _allemande(ctx: FigureContext, hand: str, clockwise: bool) -> FigureResult:
    state = ctx.start_state
    participants = ctx.participants

    if len(participants) != 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Allemande needs 2 participants, got {len(participants)}"],
        )

    d1, d2 = participants
    turns = ctx.params.get("turns", 0.5)
    total_angle = turns * 360.0
    if not clockwise:
        total_angle = -total_angle

    ds1, ds2 = state.dancers[d1], state.dancers[d2]
    center = midpoint(ds1, ds2)

    hand_enum = Hand.RIGHT if hand == "right" else Hand.LEFT
    other_hand = Hand.LEFT if hand == "right" else Hand.RIGHT
    hands = [HandConnection(d1, hand_enum, d2, hand_enum)]

    keyframes = circular_arc(
        state, [d1, d2], center, total_angle,
        ctx.beat_start, ctx.beat_end, ctx.beats_per_frame,
        hands=hands, face_center=True,
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    if keyframes:
        for did in [d1, d2]:
            end_state.dancers[did] = keyframes[-1].dancers[did].copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)


@figure("allemande_right", aliases=["allemande_r"])
def allemande_right(ctx: FigureContext) -> FigureResult:
    return _allemande(ctx, "right", clockwise=True)


@figure("allemande_left", aliases=["allemande_l"])
def allemande_left(ctx: FigureContext) -> FigureResult:
    return _allemande(ctx, "left", clockwise=False)
