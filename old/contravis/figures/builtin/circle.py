"""Circle left/right: all dancers take hands in a ring and walk around."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection
from ...interpolation import circular_arc


@figure("circle_left", aliases=["circle_l"])
def circle_left(ctx: FigureContext) -> FigureResult:
    """Circle left: all participants take hands and walk counter-clockwise."""
    return _circle(ctx, clockwise=False)


@figure("circle_right", aliases=["circle_r"])
def circle_right(ctx: FigureContext) -> FigureResult:
    """Circle right: all participants take hands and walk clockwise."""
    return _circle(ctx, clockwise=True)


def _circle(ctx: FigureContext, clockwise: bool) -> FigureResult:
    state = ctx.start_state
    participants = ctx.participants
    turns = ctx.params.get("turns", 1.0)

    if len(participants) < 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Circle needs at least 2 participants, got {len(participants)}"],
        )

    # Compute center of all participants
    xs = [state.dancers[d].x for d in participants]
    ys = [state.dancers[d].y for d in participants]
    center = (sum(xs) / len(xs), sum(ys) / len(ys))

    total_angle = turns * 360.0
    if not clockwise:
        total_angle = -total_angle

    # Hand connections: each dancer holds hands with neighbors in the ring
    hands = []
    for i in range(len(participants)):
        j = (i + 1) % len(participants)
        hands.append(HandConnection(
            participants[i], Hand.LEFT,
            participants[j], Hand.RIGHT,
        ))

    keyframes = circular_arc(
        state, participants, center, total_angle,
        ctx.beat_start, ctx.beat_end, ctx.beats_per_frame,
        hands=hands, face_center=True,
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    if keyframes:
        for did in participants:
            end_state.dancers[did] = keyframes[-1].dancers[did].copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)
