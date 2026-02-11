"""Swing figure: coupled rotation around mutual center."""

from __future__ import annotations

import math

from ..base import FigureContext, figure
from ...types import DancerID, DancerState, FigureResult, Hand, HandConnection, Keyframe, WorldState
from ...interpolation import orbit


def _orbit_end_positions(
    d1: DancerID, d2: DancerID,
    state: WorldState,
    revolutions: float,
    closing_distance: float,
) -> dict[DancerID, tuple[float, float]]:
    """Compute where the orbit would place dancers at the end, without
    generating all the keyframes. Mirrors the t=1.0 logic in orbit()."""
    ds1, ds2 = state.dancers[d1], state.dancers[d2]
    cx, cy = (ds1.x + ds2.x) / 2, (ds1.y + ds2.y) / 2
    initial_r = math.hypot(ds1.x - ds2.x, ds1.y - ds2.y) / 2

    angle1 = math.atan2(ds1.x - cx, ds1.y - cy)
    angle2 = math.atan2(ds2.x - cx, ds2.y - cy)

    total_angle = revolutions * 2 * math.pi
    # At t=1.0, radius has reopened to initial_r
    a1 = angle1 + total_angle
    a2 = angle2 + total_angle
    return {
        d1: (cx + initial_r * math.sin(a1), cy + initial_r * math.cos(a1)),
        d2: (cx + initial_r * math.sin(a2), cy + initial_r * math.cos(a2)),
    }


def _end_state_error(
    orbit_ends: dict[DancerID, tuple[float, float]],
    desired: dict[DancerID, tuple[float, float]],
) -> float:
    """Sum of squared distances from orbit end positions to desired positions."""
    total = 0.0
    for did in orbit_ends:
        ox, oy = orbit_ends[did]
        dx, dy = desired[did]
        total += (ox - dx) ** 2 + (oy - dy) ** 2
    return total


@figure("swing", aliases=["partner_swing", "neighbor_swing"])
def swing(ctx: FigureContext) -> FigureResult:
    """Swing: two dancers orbit around their mutual center.

    Typically 8-16 beats, ~1 revolution per 4 beats.
    Ends with dancers side-by-side facing a direction, lark on left,
    robin on right (relative to their facing direction).

    Required params (caller must supply):
        target_facing: ending facing in degrees (0=up, 90=east, 180=down, 270=west)
        end_center: (x, y) where the couple's midpoint should end up

    Optional params:
        revolutions: override number of revolutions (default: optimized from duration/4)
    """
    state = ctx.start_state
    participants = ctx.participants

    if len(participants) != 2:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[f"Swing needs exactly 2 participants, got {len(participants)}"],
        )

    d1, d2 = participants[0], participants[1]

    # Determine which is lark, which is robin
    if d1.is_lark:
        lark, robin = d1, d2
    else:
        lark, robin = d2, d1

    target_facing = ctx.params.get("target_facing")
    end_center = ctx.params.get("end_center")

    if target_facing is None or end_center is None:
        return FigureResult(
            keyframes=[], end_state=state.copy(),
            warnings=[
                f"Swing requires 'target_facing' and 'end_center' params. "
                f"Got target_facing={target_facing}, end_center={end_center}. "
                f"The LLM caller must determine the appropriate end formation."
            ],
        )

    # Compute desired end positions
    ecx, ecy = end_center
    facing_rad = math.radians(target_facing)
    perp_x = -math.cos(facing_rad)  # perpendicular left
    perp_y = math.sin(facing_rad)
    sep = 0.5  # half-separation between dancers (1.0m = normal set spacing)

    desired = {
        lark: (ecx + perp_x * sep, ecy + perp_y * sep),
        robin: (ecx - perp_x * sep, ecy - perp_y * sep),
    }

    duration = ctx.duration
    closing_distance = 0.15

    if "revolutions" in ctx.params:
        revolutions = ctx.params["revolutions"]
    else:
        # Optimize: start from naive guess (1 rev per 4 beats), search ±0.5 rev
        naive = duration / 4.0
        best_rev = naive
        best_err = float("inf")
        # Sample at 0.01-revolution increments over ±0.5
        for offset_cent in range(-50, 51):
            candidate = naive + offset_cent / 100.0
            if candidate < 0.5:
                continue
            ends = _orbit_end_positions(d1, d2, state, candidate, closing_distance)
            err = _end_state_error(ends, desired)
            if err < best_err:
                best_err = err
                best_rev = candidate
        revolutions = best_rev

    # Generate the orbit keyframes
    hands = [
        HandConnection(lark, Hand.RIGHT, robin, Hand.LEFT),
    ]
    keyframes = orbit(
        state,
        (d1, d2),
        total_revolutions=revolutions,
        beat_start=ctx.beat_start,
        beat_end=ctx.beat_end,
        beats_per_frame=ctx.beats_per_frame,
        closing_distance=closing_distance,
        hands=hands,
    )

    end_state = state.copy()
    end_state.beat = ctx.beat_end
    end_state.dancers[lark] = DancerState(
        x=desired[lark][0], y=desired[lark][1], facing=target_facing,
    )
    end_state.dancers[robin] = DancerState(
        x=desired[robin][0], y=desired[robin][1], facing=target_facing,
    )

    # Adjust the last keyframe to match end state (should now be a tiny correction)
    if keyframes:
        last = keyframes[-1]
        for did in [lark, robin]:
            last.dancers[did] = end_state.dancers[did].copy()

    return FigureResult(keyframes=keyframes, end_state=end_state)
