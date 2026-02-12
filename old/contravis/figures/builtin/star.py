"""Star left/right: dancers put hands in the center and walk around."""

from __future__ import annotations

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection
from ...interpolation import circular_arc


@figure("star_left", aliases=["star_l", "left_hand_star"])
def star_left(ctx: FigureContext) -> FigureResult:
    """Star left: dancers put left hands in and walk counter-clockwise."""
    return _star(ctx, clockwise=False, hand="left")


@figure("star_right", aliases=["star_r", "right_hand_star"])
def star_right(ctx: FigureContext) -> FigureResult:
    """Star right: dancers put right hands in and walk clockwise."""
    return _star(ctx, clockwise=True, hand="right")


def _star(ctx: FigureContext, clockwise: bool, hand: str) -> FigureResult:
    state = ctx.start_state
    participants = ctx.participants
    turns = ctx.params.get("turns", 1.0)

    if len(participants) < 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Star needs at least 2 participants, got {len(participants)}"],
        )

    xs = [state.dancers[d].x for d in participants]
    ys = [state.dancers[d].y for d in participants]
    center = (sum(xs) / len(xs), sum(ys) / len(ys))

    total_angle = turns * 360.0
    if not clockwise:
        total_angle = -total_angle

    # In a star, dancers don't hold each other's hands — they all reach
    # into the center. We represent this as no HandConnections (the visual
    # would need a different rendering for "hands in center").
    keyframes = circular_arc(
        state, participants, center, total_angle,
        ctx.beat_start, ctx.beat_end, ctx.beats_per_frame,
        face_center=False,  # dancers face the direction they're walking
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    if keyframes:
        for did in participants:
            end_state.dancers[did] = keyframes[-1].dancers[did].copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)
