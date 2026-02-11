"""CLI entry point for the contra dance visualizer."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Contra dance visualizer: parse a dance description and animate it.",
    )
    parser.add_argument(
        "dance_file",
        nargs="?",
        help="Path to a text file containing the dance description. "
        "If omitted, reads from stdin.",
    )
    parser.add_argument(
        "-o", "--output",
        default="dance.html",
        help="Output HTML file path (default: dance.html)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="LLM model to use for parsing (default: claude-sonnet-4-20250514)",
    )
    parser.add_argument(
        "--no-llm",
        action="store_true",
        help="Skip LLM parsing; expects a JSON file of FigureCalls instead.",
    )
    parser.add_argument(
        "--formation",
        default="improper",
        choices=["improper", "beckett"],
        help="Starting formation (default: improper, overridden by [formation:] header)",
    )
    parser.add_argument(
        "--progression",
        type=float,
        default=1.0,
        help="Expected progression in meters per 64 beats (default: 1.0)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Print state after each figure",
    )

    args = parser.parse_args()

    # Read dance description
    if args.dance_file:
        text = Path(args.dance_file).read_text()
    elif not sys.stdin.isatty():
        text = sys.stdin.read()
    else:
        parser.print_help()
        sys.exit(1)

    from contravis.types import Formation

    if args.no_llm:
        # JSON mode: parse figure calls directly
        import json
        from contravis.types import FigureCall

        raw = json.loads(text)
        formation = Formation(args.formation)
        calls = [
            FigureCall(
                name=fc["name"],
                beat_start=float(fc["beat_start"]),
                beat_end=float(fc["beat_end"]),
                participants=fc.get("participants", []),
                params=fc.get("params", {}),
                raw_text=fc.get("raw_text", ""),
            )
            for fc in raw
        ]
    else:
        # LLM mode: parse dance text
        from contravis.llm.outer import parse_dance
        formation, calls = parse_dance(text, model=args.model)

    if args.verbose:
        print(f"Parsed {len(calls)} figure calls:")
        for fc in calls:
            print(f"  [{fc.beat_start:.0f}-{fc.beat_end:.0f}] {fc.name} "
                  f"({', '.join(fc.participants)})")
        print()

    # Run pipeline
    from contravis.pipeline import run_pipeline
    from contravis.render.html_canvas import render_html

    keyframes, final_state, warnings = run_pipeline(
        calls,
        formation=formation,
        progression=args.progression,
        verbose=args.verbose,
    )

    if warnings:
        print(f"\n{len(warnings)} warnings:")
        for w in warnings:
            print(f"  ⚠ {w}")

    # Render
    progression_rate = -args.progression / 64.0
    output = render_html(
        keyframes, args.output,
        title=Path(args.dance_file).stem if args.dance_file else "Contra Dance",
        progression_rate=progression_rate,
    )
    print(f"\nWrote {output} ({len(keyframes)} keyframes)")


if __name__ == "__main__":
    main()
