"""Balance figure: step towards partner, then step back. 4 beats."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection, Keyframe
from ...interpolation import linear


@figure("balance", aliases=["balance_right", "balance_left"])
def balance(ctx: FigureContext) -> FigureResult:
    """Balance: each pair of participants steps toward each other, then back.

    Typically 4 beats. Participants step ~0.3m towards each other on beats 0-2,
    then back to starting position on beats 2-4.
    """
    state = ctx.start_state
    participants = ctx.participants
    step_distance = ctx.params.get("step_distance", 0.3)

    # Group participants into pairs — they should come in pairs
    pairs: list[tuple[DancerID, DancerID]] = []
    used = set()
    for i, d1 in enumerate(participants):
        if d1 in used:
            continue
        # Find the closest other participant
        best = None
        best_dist = float("inf")
        for d2 in participants:
            if d2 == d1 or d2 in used:
                continue
            ds1, ds2 = state.dancers[d1], state.dancers[d2]
            dist = math.hypot(ds1.x - ds2.x, ds1.y - ds2.y)
            if dist < best_dist:
                best_dist = dist
                best = d2
        if best is not None:
            pairs.append((d1, best))
            used.add(d1)
            used.add(best)

    mid_beat = (ctx.beat_start + ctx.beat_end) / 2

    # Phase 1: step towards each other
    targets_in: dict[DancerID, DancerState] = {}
    for d1, d2 in pairs:
        ds1, ds2 = state.dancers[d1], state.dancers[d2]
        dx = ds2.x - ds1.x
        dy = ds2.y - ds1.y
        dist = math.hypot(dx, dy)
        if dist > 0:
            nx, ny = dx / dist, dy / dist
        else:
            nx, ny = 0.0, 0.0
        targets_in[d1] = DancerState(
            x=ds1.x + nx * step_distance,
            y=ds1.y + ny * step_distance,
            facing=ds1.facing,
        )
        targets_in[d2] = DancerState(
            x=ds2.x - nx * step_distance,
            y=ds2.y - ny * step_distance,
            facing=ds2.facing,
        )

    kf1 = linear(
        state, targets_in,
        ctx.beat_start, mid_beat,
        ctx.beats_per_frame,
    )

    # Phase 2: step back
    # Build the mid-state from the last keyframe of phase 1
    mid_state = state.copy()
    mid_state.beat = mid_beat
    if kf1:
        last = kf1[-1]
        for did, ds in last.dancers.items():
            mid_state.dancers[did] = ds.copy()

    targets_back: dict[DancerID, DancerState] = {}
    for did in targets_in:
        targets_back[did] = state.dancers[did].copy()

    kf2 = linear(
        mid_state, targets_back,
        mid_beat, ctx.beat_end,
        ctx.beats_per_frame,
    )

    # Combine, removing duplicate at midpoint
    keyframes = kf1 + kf2[1:]

    end_state = state.copy()
    end_state.beat = ctx.beat_end

    return FigureResult(keyframes=keyframes, end_state=end_state)
