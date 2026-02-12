"""Robins chain (or larks chain): pull by in the middle, courtesy turn on the sides."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection
from ...interpolation import linear, circular_arc
from ...world import midpoint


@figure("robins_chain", aliases=["ladies_chain", "chain"])
def robins_chain(ctx: FigureContext) -> FigureResult:
    """Robins chain: 8 beats.

    All 4 dancers participate. Robins pull by right in the middle (beats 0-3),
    then courtesy turn with the lark on the other side (beats 3-8).

    Expects all 4 dancers as participants.
    """
    state = ctx.start_state

    # Identify robins and larks
    robins = [d for d in ctx.participants if d.is_robin]
    larks = [d for d in ctx.participants if d.is_lark]

    if len(robins) != 2 or len(larks) != 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Chain needs 2 robins and 2 larks, got {len(robins)}R {len(larks)}L"],
        )

    mid_beat = ctx.beat_start + ctx.duration * 3 / 8  # pull by takes ~3/8

    # Phase 1: Robins pull by right in the middle
    r1, r2 = robins
    ds_r1, ds_r2 = state.dancers[r1], state.dancers[r2]

    # Robins swap positions
    robin_targets = {
        r1: DancerState(x=ds_r2.x, y=ds_r2.y, facing=ds_r2.facing),
        r2: DancerState(x=ds_r1.x, y=ds_r1.y, facing=ds_r1.facing),
    }
    # Larks step slightly towards the middle to receive
    lark_targets = {}
    for l in larks:
        ds = state.dancers[l]
        lark_targets[l] = DancerState(
            x=ds.x * 0.7, y=ds.y, facing=ds.facing,
        )

    all_targets_1 = {**robin_targets, **lark_targets}
    hands_1 = [HandConnection(r1, Hand.RIGHT, r2, Hand.RIGHT)]
    kf1 = linear(
        state, all_targets_1,
        ctx.beat_start, mid_beat, ctx.beats_per_frame,
        hands=hands_1,
    )

    # Phase 2: Courtesy turn — each robin turns with the lark on their new side
    mid_state = state.copy()
    mid_state.beat = mid_beat
    if kf1:
        for did, ds in kf1[-1].dancers.items():
            mid_state.dancers[did] = ds.copy()

    # Pair each robin with the nearest lark
    def find_nearest_lark(robin_did: DancerID) -> DancerID:
        ds_r = mid_state.dancers[robin_did]
        best = larks[0]
        best_dist = float("inf")
        for l in larks:
            ds_l = mid_state.dancers[l]
            d = math.hypot(ds_r.x - ds_l.x, ds_r.y - ds_l.y)
            if d < best_dist:
                best_dist = d
                best = l
        return best

    pairs_2 = []
    used_larks: set[DancerID] = set()
    for r in robins:
        l = find_nearest_lark(r)
        if l in used_larks:
            l = [x for x in larks if x not in used_larks][0]
        pairs_2.append((r, l))
        used_larks.add(l)

    # Courtesy turn: couple rotates CCW ~180° around their midpoint,
    # ending facing across the set
    all_kf2: list = []
    end_state = mid_state.copy()
    for r, l in pairs_2:
        ds_r, ds_l = mid_state.dancers[r], mid_state.dancers[l]
        center = midpoint(ds_r, ds_l)
        hands_ct = [HandConnection(l, Hand.LEFT, r, Hand.LEFT)]
        kf_ct = circular_arc(
            mid_state, [r, l], center, -180.0,
            mid_beat, ctx.beat_end, ctx.beats_per_frame,
            hands=hands_ct, face_center=True,
        )
        if kf_ct:
            for did in [r, l]:
                end_state.dancers[did] = kf_ct[-1].dancers[did].copy()
        all_kf2.extend(kf_ct)

    end_state.beat = ctx.beat_end

    # Combine phase 1 and phase 2
    # Phase 2 keyframes may have duplicates for non-participants; the merge
    # in the pipeline handles this. For now, just concatenate.
    keyframes = kf1 + all_kf2

    return FigureResult(keyframes=keyframes, end_state=end_state)
