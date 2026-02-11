"""Core data types for the contra dance visualizer."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class DancerID(Enum):
    UP_LARK = "up_lark"
    UP_ROBIN = "up_robin"
    DOWN_LARK = "down_lark"
    DOWN_ROBIN = "down_robin"

    @property
    def is_lark(self) -> bool:
        return self in (DancerID.UP_LARK, DancerID.DOWN_LARK)

    @property
    def is_robin(self) -> bool:
        return not self.is_lark

    @property
    def is_up(self) -> bool:
        return self in (DancerID.UP_LARK, DancerID.UP_ROBIN)

    @property
    def is_down(self) -> bool:
        return not self.is_up

    @property
    def role(self) -> str:
        return "lark" if self.is_lark else "robin"

    @property
    def direction(self) -> str:
        return "up" if self.is_up else "down"

    @property
    def partner(self) -> DancerID:
        return {
            DancerID.UP_LARK: DancerID.UP_ROBIN,
            DancerID.UP_ROBIN: DancerID.UP_LARK,
            DancerID.DOWN_LARK: DancerID.DOWN_ROBIN,
            DancerID.DOWN_ROBIN: DancerID.DOWN_LARK,
        }[self]

    @property
    def neighbor(self) -> DancerID:
        return {
            DancerID.UP_LARK: DancerID.DOWN_ROBIN,
            DancerID.UP_ROBIN: DancerID.DOWN_LARK,
            DancerID.DOWN_LARK: DancerID.UP_ROBIN,
            DancerID.DOWN_ROBIN: DancerID.UP_LARK,
        }[self]

    @property
    def opposite(self) -> DancerID:
        return self.neighbor.partner


class Hand(Enum):
    LEFT = "left"
    RIGHT = "right"


class Formation(Enum):
    IMPROPER = "improper"
    BECKETT = "beckett"


@dataclass
class DancerState:
    x: float
    y: float
    facing: float  # degrees, 0=up/north, 90=east, 180=down, 270=west
    vx: float = 0.0
    vy: float = 0.0

    def copy(self) -> DancerState:
        return DancerState(self.x, self.y, self.facing, self.vx, self.vy)


@dataclass
class HandConnection:
    dancer_a: DancerID
    hand_a: Hand
    dancer_b: DancerID
    hand_b: Hand


@dataclass
class WorldState:
    beat: float
    dancers: dict[DancerID, DancerState]
    hands: list[HandConnection] = field(default_factory=list)

    def copy(self) -> WorldState:
        return WorldState(
            beat=self.beat,
            dancers={did: ds.copy() for did, ds in self.dancers.items()},
            hands=list(self.hands),
        )


@dataclass
class FigureCall:
    name: str
    beat_start: float
    beat_end: float
    participants: list[str]  # role references like "neighbors", "partners"
    params: dict[str, Any] = field(default_factory=dict)
    raw_text: str = ""


@dataclass
class Keyframe:
    beat: float
    dancers: dict[DancerID, DancerState]
    hands: list[HandConnection] = field(default_factory=list)
    annotation: str = ""


@dataclass
class FigureResult:
    keyframes: list[Keyframe]
    end_state: WorldState
    warnings: list[str] = field(default_factory=list)
