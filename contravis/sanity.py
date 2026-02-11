"""Sanity checks for keyframe sequences.

All checks produce warnings only (contra dance has few hard rules).
The one exception: progression invariant after 64 beats.
"""

from __future__ import annotations

import math

from .types import DancerID, Keyframe, WorldState


def check_collisions(
    keyframes: list[Keyframe],
    min_distance: float = 0.3,
) -> list[str]:
    """Warn if any two dancers get closer than min_distance."""
    warnings: list[str] = []
    for kf in keyframes:
        dancers = list(kf.dancers.items())
        for i in range(len(dancers)):
            for j in range(i + 1, len(dancers)):
                did_a, ds_a = dancers[i]
                did_b, ds_b = dancers[j]
                d = math.hypot(ds_a.x - ds_b.x, ds_a.y - ds_b.y)
                if d < min_distance:
                    warnings.append(
                        f"Beat {kf.beat:.1f}: {did_a.value} and {did_b.value} "
                        f"are {d:.2f}m apart (< {min_distance}m)"
                    )
    return warnings


def check_speed(
    keyframes: list[Keyframe],
    max_speed: float = 1.0,
    warn_speed: float = 0.5,
) -> list[str]:
    """Warn if dancers move faster than expected."""
    warnings: list[str] = []
    for i in range(1, len(keyframes)):
        dt = keyframes[i].beat - keyframes[i - 1].beat
        if dt <= 0:
            continue
        for did in DancerID:
            prev = keyframes[i - 1].dancers[did]
            curr = keyframes[i].dancers[did]
            dx = curr.x - prev.x
            dy = curr.y - prev.y
            speed = math.hypot(dx, dy) / dt
            if speed > max_speed:
                warnings.append(
                    f"Beat {keyframes[i].beat:.1f}: {did.value} moving at "
                    f"{speed:.2f}m/beat (> {max_speed})"
                )
            elif speed > warn_speed:
                pass  # could add soft warnings
    return warnings


def check_spin(
    keyframes: list[Keyframe],
    max_spin: float = 180.0,
) -> list[str]:
    """Warn if dancers rotate faster than max_spin degrees/beat."""
    warnings: list[str] = []
    for i in range(1, len(keyframes)):
        dt = keyframes[i].beat - keyframes[i - 1].beat
        if dt <= 0:
            continue
        for did in DancerID:
            prev_facing = keyframes[i - 1].dancers[did].facing
            curr_facing = keyframes[i].dancers[did].facing
            diff = abs((curr_facing - prev_facing + 180) % 360 - 180)
            spin_rate = diff / dt
            if spin_rate > max_spin:
                warnings.append(
                    f"Beat {keyframes[i].beat:.1f}: {did.value} spinning at "
                    f"{spin_rate:.0f}°/beat (> {max_spin}°/beat)"
                )
    return warnings


def check_progression(
    start: WorldState,
    end: WorldState,
    expected_displacement: float = 1.0,
    tolerance: float = 0.15,
) -> list[str]:
    """Check that each dancer has progressed the expected amount.

    Up dancers should move up (positive y), down dancers should move down (negative y).
    """
    warnings: list[str] = []
    for did in DancerID:
        ds_start = start.dancers[did]
        ds_end = end.dancers[did]
        dy = ds_end.y - ds_start.y
        dx = abs(ds_end.x - ds_start.x)

        if did.is_up:
            expected_y = expected_displacement
        else:
            expected_y = -expected_displacement

        y_error = abs(dy - expected_y)
        if y_error > tolerance:
            warnings.append(
                f"Progression: {did.value} displaced by ({dx:.2f}, {dy:.2f}), "
                f"expected (0, {expected_y:.1f})"
            )
        if dx > tolerance:
            warnings.append(
                f"Progression: {did.value} has x-displacement of {dx:.2f} "
                f"(expected ~0)"
            )
    return warnings


def run_all_checks(keyframes: list[Keyframe]) -> list[str]:
    """Run collision, speed, and spin checks on a keyframe sequence."""
    warnings: list[str] = []
    warnings.extend(check_collisions(keyframes))
    warnings.extend(check_speed(keyframes))
    warnings.extend(check_spin(keyframes))
    return warnings
