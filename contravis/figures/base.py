"""Figure protocol, registry, and decorator."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

from ..types import DancerID, FigureCall, FigureResult, WorldState


@dataclass
class FigureContext:
    """Context passed to every figure function."""
    call: FigureCall
    start_state: WorldState
    participants: list[DancerID]
    beats_per_frame: float = 0.25

    @property
    def beat_start(self) -> float:
        return self.call.beat_start

    @property
    def beat_end(self) -> float:
        return self.call.beat_end

    @property
    def duration(self) -> float:
        return self.call.beat_end - self.call.beat_start

    @property
    def params(self) -> dict[str, Any]:
        return self.call.params


class FigureFunc(Protocol):
    def __call__(self, ctx: FigureContext) -> FigureResult: ...


# Global figure registry
_registry: dict[str, FigureFunc] = {}


def figure(name: str, aliases: list[str] | None = None):
    """Decorator to register a figure function.

    Usage:
        @figure("allemande_right", aliases=["allemande_r"])
        def allemande_right(ctx: FigureContext) -> FigureResult: ...
    """
    def decorator(func: FigureFunc) -> FigureFunc:
        _registry[name] = func
        for alias in (aliases or []):
            _registry[alias] = func
        func._figure_name = name  # type: ignore
        return func
    return decorator


def get_figure(name: str) -> FigureFunc | None:
    """Look up a figure by name."""
    return _registry.get(name)


def list_figures() -> list[str]:
    """Return all registered figure names (excluding aliases)."""
    seen = set()
    names = []
    for name, func in _registry.items():
        fname = getattr(func, '_figure_name', name)
        if fname not in seen:
            seen.add(fname)
            names.append(fname)
    return sorted(names)


def register_figure(name: str, func: FigureFunc, aliases: list[str] | None = None):
    """Programmatically register a figure function."""
    _registry[name] = func
    for alias in (aliases or []):
        _registry[alias] = func
