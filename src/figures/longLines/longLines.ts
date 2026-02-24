import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection } from '../../types';
import { Vector, makeDancerId, parseDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, isLark, resolveInsideHand, findDancerOnSide, angleBetweenFacings } from '../../generateUtils';

/**
 * Long lines forward and back: 8 beats by default.
 *
 * For every dancer in scope:
 * - Assert there's somebody on your right; assert they face roughly the same
 *   direction (<0.5 rad); assert roughly the same x-coordinate (<0.5m); assert
 *   opposite role; take inside hands.
 * - Same for the person on your left.
 *
 * Then dancers step toward the middle of the set (until x=±0.2) for half the
 * beats, then back out (until x=±0.5) for the other half.
 */

function assertAndTakeHands(
  prev: Keyframe,
  scope: Set<ProtoDancerId>,
): HandConnection[] {
  const newHands: HandConnection[] = [...prev.hands];
  const seen = new Set<string>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];

    for (const side of ['on_left', 'on_right'] as const) {
      const neighbor = findDancerOnSide(id, side, prev.dancers);
      if (!neighbor) {
        throw new Error(
          `long_lines: ${id} has nobody on their ${side}`,
        );
      }

      const { proto: targetProto } = parseDancerId(neighbor.dancerId);
      const target = dancerPosition(neighbor.dancerId, prev.dancers);

      // Assert roughly same direction (<0.5 rad)
      const angle = angleBetweenFacings(d.facing, target.facing);
      if (angle >= 0.5) {
        throw new Error(
          `long_lines: ${id} and ${neighbor.dancerId} are not facing roughly the same direction (angle between facings: ${angle.toFixed(2)} rad)`,
        );
      }

      // Assert roughly same x-coordinate (<0.5m)
      if (Math.abs(d.pos.x - target.pos.x) >= 0.5) {
        throw new Error(
          `long_lines: ${id} and ${neighbor.dancerId} don't have roughly the same x-coordinate (Δx = ${Math.abs(d.pos.x - target.pos.x).toFixed(2)}m)`,
        );
      }

      // Assert opposite role
      if (isLark(id) === isLark(targetProto)) {
        throw new Error(
          `long_lines: ${id} and ${targetProto} have the same role`,
        );
      }

      // Take inside hands (deduplicated)
      const aId = makeDancerId(id, 0);
      const key = aId < neighbor.dancerId ? `${aId}:${neighbor.dancerId}` : `${neighbor.dancerId}:${aId}`;
      if (!seen.has(key)) {
        seen.add(key);
        const ha = resolveInsideHand(d, target);
        const hb = resolveInsideHand(target, d);
        newHands.push({ a: aId, ha, b: neighbor.dancerId, hb });
      }
    }
  }

  return newHands;
}

export function finalLongLines(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'long_lines' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  // Assertions and hand-taking happen; dancers return to starting position
  const hands = assertAndTakeHands(prev, scope);

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands,
  });
}

export function generateLongLines(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'long_lines' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  const hands = assertAndTakeHands(prev, scope);

  // Compute "forward" (middle) positions: each dancer moves to x=±0.2
  // keeping their y and facing
  const middleDancers = copyDancers(prev.dancers);
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const sign = middleDancers[id].pos.x < 0 ? -1 : 1;
    middleDancers[id].pos = new Vector(sign * 0.2, middleDancers[id].pos.y);
  }

  return (t: number) => {
    const beat = prev.beat + t * instr.beats;
    const dancers = copyDancers(prev.dancers);

    if (t <= 0.5) {
      // Phase 1: step toward middle
      const tPhase = t / 0.5;
      for (const id of PROTO_DANCER_IDS) {
        if (!scope.has(id)) continue;
        dancers[id].pos = prev.dancers[id].pos.add(
          middleDancers[id].pos.subtract(prev.dancers[id].pos).multiply(tPhase),
        );
      }
    } else {
      // Phase 2: step back out
      const tPhase = (t - 0.5) / 0.5;
      for (const id of PROTO_DANCER_IDS) {
        if (!scope.has(id)) continue;
        dancers[id].pos = middleDancers[id].pos.add(
          prev.dancers[id].pos.subtract(middleDancers[id].pos).multiply(tPhase),
        );
      }
    }

    return { beat, dancers, hands };
  };
}
