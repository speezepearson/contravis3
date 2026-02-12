"""Orchestrates parse → resolve → interpolate → render."""

from __future__ import annotations

import importlib
import traceback
from pathlib import Path

from .types import (
    DancerID, FigureCall, FigureResult, Formation, Keyframe, WorldState,
)
from .world import make_formation, resolve_participant_group
from .figures import ensure_loaded
from .figures.base import FigureContext, get_figure, list_figures
from .interpolation import merge_keyframe_lists
from .sanity import run_all_checks, check_progression
from .ascii_viz import render_state_compact


def run_pipeline(
    figure_calls: list[FigureCall],
    formation: Formation = Formation.IMPROPER,
    progression: float = 1.0,
    verbose: bool = False,
) -> tuple[list[Keyframe], WorldState, list[str]]:
    """Execute a sequence of figure calls and produce keyframes.

    Args:
        figure_calls: Ordered list of figure calls to execute.
        formation: Starting formation.
        progression: Expected displacement per 64 beats (1.0 = single).
        verbose: Print state after each figure.

    Returns:
        (all_keyframes, final_state, all_warnings)
    """
    ensure_loaded()

    state = make_formation(formation)
    start_state = state.copy()
    all_keyframes: list[Keyframe] = []
    all_warnings: list[str] = []

    if verbose:
        print(f"Starting formation: {formation.value}")
        print(render_state_compact(state))
        print()

    # Group concurrent figures (same beat range)
    groups = _group_concurrent(figure_calls)

    for group in groups:
        if verbose:
            names = [fc.name for fc in group]
            print(f"--- Beat {group[0].beat_start}-{group[0].beat_end}: {', '.join(names)} ---")

        concurrent_results: list[tuple[list[Keyframe], set[DancerID]]] = []

        for fc in group:
            fig_func = get_figure(fc.name)
            if fig_func is None:
                all_warnings.append(f"Unknown figure: {fc.name}")
                continue

            # Resolve participants into pairs
            participant_pairs = _resolve_participant_pairs(fc.participants)
            if not participant_pairs:
                all_warnings.append(
                    f"Could not resolve participants for {fc.name}: {fc.participants}"
                )
                continue

            # Try running with all participants first. If the figure
            # rejects the count (e.g. swing wants 2 but got 4), fall
            # back to running once per pair.
            all_participants = [d for pair in participant_pairs for d in pair]
            ctx = FigureContext(
                call=fc, start_state=state, participants=all_participants,
            )
            result = fig_func(ctx)

            if result.warnings and any("participants" in w.lower() for w in result.warnings):
                # Figure rejected the participant count — run per pair
                for pair in participant_pairs:
                    pair_list = list(pair)
                    ctx = FigureContext(
                        call=fc, start_state=state, participants=pair_list,
                    )
                    pair_result = fig_func(ctx)
                    all_warnings.extend(pair_result.warnings)
                    if pair_result.keyframes:
                        concurrent_results.append(
                            (pair_result.keyframes, set(pair_list))
                        )
                    for did in pair_list:
                        if did in pair_result.end_state.dancers:
                            state.dancers[did] = pair_result.end_state.dancers[did].copy()
            else:
                all_warnings.extend(result.warnings)
                if result.keyframes:
                    concurrent_results.append(
                        (result.keyframes, set(all_participants))
                    )
                for did in all_participants:
                    if did in result.end_state.dancers:
                        state.dancers[did] = result.end_state.dancers[did].copy()

        # Merge concurrent keyframes
        if concurrent_results:
            if len(concurrent_results) == 1:
                merged = concurrent_results[0][0]
            else:
                merged = merge_keyframe_lists(concurrent_results)
            all_keyframes.extend(merged)

        state.beat = group[0].beat_end

        if verbose:
            print(render_state_compact(state))
            print()

    # Sanity checks on full keyframe sequence
    kf_warnings = run_all_checks(all_keyframes)
    all_warnings.extend(kf_warnings)

    # Check progression
    if state.beat >= 64:
        prog_warnings = check_progression(start_state, state, progression)
        all_warnings.extend(prog_warnings)

    return all_keyframes, state, all_warnings


def _group_concurrent(calls: list[FigureCall]) -> list[list[FigureCall]]:
    """Group figure calls that share the same beat range."""
    if not calls:
        return []

    groups: list[list[FigureCall]] = []
    current_group: list[FigureCall] = [calls[0]]

    for fc in calls[1:]:
        if (fc.beat_start == current_group[0].beat_start
                and fc.beat_end == current_group[0].beat_end):
            current_group.append(fc)
        else:
            groups.append(current_group)
            current_group = [fc]
    groups.append(current_group)

    return groups


def _resolve_participant_pairs(
    references: list[str],
) -> list[tuple[DancerID, DancerID]]:
    """Resolve participant references to a list of (DancerID, DancerID) pairs."""
    pairs: list[tuple[DancerID, DancerID]] = []
    seen: set[tuple[DancerID, DancerID]] = set()

    for ref in references:
        ref_lower = ref.lower().strip()

        if ref_lower in ("all", "everyone"):
            return [
                (DancerID.UP_LARK, DancerID.UP_ROBIN),
                (DancerID.DOWN_LARK, DancerID.DOWN_ROBIN),
                (DancerID.UP_LARK, DancerID.DOWN_ROBIN),
                (DancerID.UP_ROBIN, DancerID.DOWN_LARK),
            ]

        try:
            resolved = resolve_participant_group(ref_lower)
            for pair in resolved:
                if pair not in seen:
                    pairs.append(pair)
                    seen.add(pair)
        except ValueError:
            pass

    return pairs
