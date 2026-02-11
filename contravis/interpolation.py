"""Interpolation strategies for generating keyframes between positions.

Three core strategies:
- circular_arc: dancers orbit a shared center (allemandes, do-si-dos, stars)
- linear: straight-line motion with easing (balances, pull-bys)
- orbit: tight coupled rotation (swings)
"""

from __future__ import annotations

import math
from typing import Callable

from .types import DancerID, DancerState, HandConnection, Keyframe, WorldState


def merge_keyframe_lists(
    lists: list[tuple[list[Keyframe], set[DancerID]]],
) -> list[Keyframe]:
    """Merge concurrent keyframe lists into one, taking each dancer's position
    from whichever list is authoritative for that dancer.

    Args:
        lists: Each element is (keyframes, authoritative_dancers).
            For each beat, the dancer's position comes from the list where
            they are in the authoritative set. Dancers not authoritative
            anywhere use the first list's position.

    Returns:
        Single merged keyframe list, sorted by beat.
    """
    if not lists:
        return []
    if len(lists) == 1:
        return lists[0][0]

    # Collect all unique beats across all lists
    all_beats: set[float] = set()
    for kf_list, _ in lists:
        for kf in kf_list:
            all_beats.add(round(kf.beat, 6))
    sorted_beats = sorted(all_beats)

    # Index each list for fast lookup by beat
    def build_index(kf_list: list[Keyframe]) -> dict[float, Keyframe]:
        return {round(kf.beat, 6): kf for kf in kf_list}

    indices = [(build_index(kf_list), auth) for kf_list, auth in lists]

    # For beats that exist in some lists but not others, interpolate
    def find_frame(beat: float, kf_list: list[Keyframe]) -> Keyframe | None:
        beat_r = round(beat, 6)
        idx = build_index(kf_list)
        if beat_r in idx:
            return idx[beat_r]
        # Binary search for surrounding frames
        if not kf_list:
            return None
        lo, hi = 0, len(kf_list) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if kf_list[mid].beat <= beat:
                lo = mid
            else:
                hi = mid
        if lo == hi:
            return kf_list[lo]
        f0, f1 = kf_list[lo], kf_list[hi]
        dt = f1.beat - f0.beat
        if dt <= 0:
            return f0
        t = (beat - f0.beat) / dt
        dancers = {}
        for did in f0.dancers:
            d0, d1 = f0.dancers[did], f1.dancers[did]
            dancers[did] = DancerState(
                x=d0.x + (d1.x - d0.x) * t,
                y=d0.y + (d1.y - d0.y) * t,
                facing=d0.facing + (((d1.facing - d0.facing + 180) % 360) - 180) * t,
            )
        return Keyframe(beat=beat, dancers=dancers, hands=f0.hands)

    merged: list[Keyframe] = []
    for beat in sorted_beats:
        # Start with a copy from the first list
        base_frame = find_frame(beat, lists[0][0])
        if base_frame is None:
            continue
        dancers = {did: ds.copy() for did, ds in base_frame.dancers.items()}
        all_hands = list(base_frame.hands)

        # Overlay authoritative dancers from each list
        for kf_list, auth_dancers in lists:
            frame = find_frame(beat, kf_list)
            if frame is None:
                continue
            for did in auth_dancers:
                if did in frame.dancers:
                    dancers[did] = frame.dancers[did].copy()
            all_hands.extend(frame.hands)

        # Deduplicate hands
        seen_hands = set()
        unique_hands = []
        for h in all_hands:
            key = (h.dancer_a, h.hand_a, h.dancer_b, h.hand_b)
            if key not in seen_hands:
                seen_hands.add(key)
                unique_hands.append(h)

        merged.append(Keyframe(beat=beat, dancers=dancers, hands=unique_hands))

    return merged


def _ease_in_out(t: float) -> float:
    """Smooth ease-in-out using cosine interpolation. t in [0,1] → [0,1]."""
    return (1 - math.cos(t * math.pi)) / 2


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _copy_dancers(state: WorldState) -> dict[DancerID, DancerState]:
    return {did: ds.copy() for did, ds in state.dancers.items()}


def circular_arc(
    state: WorldState,
    participants: list[DancerID],
    center: tuple[float, float],
    total_angle_deg: float,
    beat_start: float,
    beat_end: float,
    beats_per_frame: float = 0.25,
    hands: list[HandConnection] | None = None,
    face_center: bool = True,
) -> list[Keyframe]:
    """Generate keyframes for dancers orbiting a shared center point.

    Args:
        state: Current world state (positions read from here).
        participants: Which dancers are moving.
        center: (cx, cy) orbit center.
        total_angle_deg: Total angle to sweep. Positive = clockwise.
        beat_start, beat_end: Beat range.
        beats_per_frame: Time resolution.
        hands: Hand connections during this motion.
        face_center: If True, dancers face the center; if False, maintain initial facing.
    """
    cx, cy = center
    n_frames = max(1, int((beat_end - beat_start) / beats_per_frame))
    keyframes: list[Keyframe] = []

    # Compute initial angle for each participant relative to center
    initial_angles: dict[DancerID, float] = {}
    radii: dict[DancerID, float] = {}
    for did in participants:
        ds = state.dancers[did]
        dx = ds.x - cx
        dy = ds.y - cy
        initial_angles[did] = math.atan2(dx, dy)  # angle from center, 0=north
        radii[did] = math.hypot(dx, dy)

    total_angle_rad = math.radians(total_angle_deg)

    for i in range(n_frames + 1):
        t = i / n_frames
        beat = beat_start + t * (beat_end - beat_start)
        # Use eased t for smoother motion at start/end
        t_eased = _ease_in_out(t)
        angle_offset = t_eased * total_angle_rad

        dancers = _copy_dancers(state)
        for did in participants:
            angle = initial_angles[did] + angle_offset
            r = radii[did]
            dancers[did].x = cx + r * math.sin(angle)
            dancers[did].y = cy + r * math.cos(angle)
            if face_center:
                # Face towards center
                face_angle = math.degrees(math.atan2(cx - dancers[did].x, cy - dancers[did].y))
                dancers[did].facing = face_angle % 360.0
            else:
                # Maintain original facing
                pass

        keyframes.append(Keyframe(
            beat=beat,
            dancers=dancers,
            hands=hands or [],
        ))

    return keyframes


def linear(
    state: WorldState,
    targets: dict[DancerID, DancerState],
    beat_start: float,
    beat_end: float,
    beats_per_frame: float = 0.25,
    hands: list[HandConnection] | None = None,
    easing: Callable[[float], float] = _ease_in_out,
) -> list[Keyframe]:
    """Generate keyframes for straight-line motion between positions.

    Args:
        state: Current world state.
        targets: End positions for moving dancers.
        beat_start, beat_end: Beat range.
        beats_per_frame: Time resolution.
        hands: Hand connections during this motion.
        easing: Easing function, t → eased_t.
    """
    n_frames = max(1, int((beat_end - beat_start) / beats_per_frame))
    keyframes: list[Keyframe] = []

    for i in range(n_frames + 1):
        t = i / n_frames
        beat = beat_start + t * (beat_end - beat_start)
        t_eased = easing(t)

        dancers = _copy_dancers(state)
        for did, target in targets.items():
            src = state.dancers[did]
            dancers[did].x = _lerp(src.x, target.x, t_eased)
            dancers[did].y = _lerp(src.y, target.y, t_eased)
            # Interpolate facing (shortest path)
            diff = (target.facing - src.facing + 180) % 360 - 180
            dancers[did].facing = (src.facing + diff * t_eased) % 360.0

        keyframes.append(Keyframe(
            beat=beat,
            dancers=dancers,
            hands=hands or [],
        ))

    return keyframes


def orbit(
    state: WorldState,
    participants: tuple[DancerID, DancerID],
    total_revolutions: float,
    beat_start: float,
    beat_end: float,
    beats_per_frame: float = 0.25,
    closing_distance: float = 0.2,
    hands: list[HandConnection] | None = None,
) -> list[Keyframe]:
    """Generate keyframes for a coupled swing/orbit motion.

    Two dancers orbit around their mutual midpoint, closing distance to
    closing_distance, then separating at the end.

    Args:
        state: Current world state.
        participants: The two dancers swinging.
        total_revolutions: How many full turns (e.g. 2.5).
        beat_start, beat_end: Beat range.
        beats_per_frame: Time resolution.
        closing_distance: How close they get during the swing.
        hands: Hand connections during this motion.
    """
    d1, d2 = participants
    ds1 = state.dancers[d1]
    ds2 = state.dancers[d2]

    cx, cy = (ds1.x + ds2.x) / 2, (ds1.y + ds2.y) / 2
    initial_r = math.hypot(ds1.x - ds2.x, ds1.y - ds2.y) / 2

    # Initial angles from center
    angle1 = math.atan2(ds1.x - cx, ds1.y - cy)
    angle2 = math.atan2(ds2.x - cx, ds2.y - cy)

    total_angle = total_revolutions * 2 * math.pi
    n_frames = max(1, int((beat_end - beat_start) / beats_per_frame))
    keyframes: list[Keyframe] = []

    for i in range(n_frames + 1):
        t = i / n_frames
        beat = beat_start + t * (beat_end - beat_start)

        # Angle sweeps linearly (constant angular velocity during swing)
        angle_offset = t * total_angle

        # Radius: close in quickly at start, stay close, open up at end
        if t < 0.1:
            r = _lerp(initial_r, closing_distance, t / 0.1)
        elif t > 0.9:
            r = _lerp(closing_distance, initial_r, (t - 0.9) / 0.1)
        else:
            r = closing_distance

        dancers = _copy_dancers(state)
        a1 = angle1 + angle_offset
        a2 = angle2 + angle_offset
        dancers[d1].x = cx + r * math.sin(a1)
        dancers[d1].y = cy + r * math.cos(a1)
        dancers[d2].x = cx + r * math.sin(a2)
        dancers[d2].y = cy + r * math.cos(a2)

        # Both face their partner (towards center of orbit)
        dancers[d1].facing = math.degrees(math.atan2(cx - dancers[d1].x, cy - dancers[d1].y)) % 360
        dancers[d2].facing = math.degrees(math.atan2(cx - dancers[d2].x, cy - dancers[d2].y)) % 360

        keyframes.append(Keyframe(
            beat=beat,
            dancers=dancers,
            hands=hands or [],
        ))

    return keyframes
