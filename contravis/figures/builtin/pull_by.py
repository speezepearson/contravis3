"""Pull by: two dancers take hands and quickly walk past each other."""

from __future__ import annotations

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection
from ...interpolation import linear


@figure("pull_by_right", aliases=["pull_by_r"])
def pull_by_right(ctx: FigureContext) -> FigureResult:
    return _pull_by(ctx, "right")


@figure("pull_by_left", aliases=["pull_by_l"])
def pull_by_left(ctx: FigureContext) -> FigureResult:
    return _pull_by(ctx, "left")


def _pull_by(ctx: FigureContext, hand: str) -> FigureResult:
    """Pull by: dancers swap positions along a straight line.

    Typically 2 beats.
    """
    state = ctx.start_state
    participants = ctx.participants

    if len(participants) != 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Pull by needs 2 participants, got {len(participants)}"],
        )

    d1, d2 = participants
    ds1, ds2 = state.dancers[d1], state.dancers[d2]

    # Swap positions, keep original facing
    targets = {
        d1: DancerState(x=ds2.x, y=ds2.y, facing=ds1.facing),
        d2: DancerState(x=ds1.x, y=ds1.y, facing=ds2.facing),
    }

    hand_enum = Hand.RIGHT if hand == "right" else Hand.LEFT
    hands = [HandConnection(d1, hand_enum, d2, hand_enum)]

    keyframes = linear(
        state, targets,
        ctx.beat_start, ctx.beat_end, ctx.beats_per_frame,
        hands=hands,
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    end_state.dancers[d1] = targets[d1].copy()
    end_state.dancers[d2] = targets[d2].copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)
