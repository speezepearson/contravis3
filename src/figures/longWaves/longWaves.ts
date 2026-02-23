import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection } from '../../types';
import { makeDancerId, parseDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, isLark, resolveInsideHand, findNeighborOnSide, angleBetweenFacings } from '../../generateUtils';

/**
 * Long waves: 0-beat assertion figure.
 *
 * For every dancer in scope:
 * - Assert there's somebody on your right; assert they face roughly the opposite
 *   direction (<0.5 rad); assert roughly the same x-coordinate (<0.5m); assert
 *   opposite role; take inside hands.
 * - Same for the person on your left.
 */

export function finalLongWaves(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'long_waves' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const newHands: HandConnection[] = [...prev.hands];
  const seen = new Set<string>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];

    for (const side of ['left', 'right'] as const) {
      const neighbor = findNeighborOnSide(id, side, prev.dancers);
      if (!neighbor) {
        throw new Error(
          `long_waves: ${id} has nobody on their ${side}`,
        );
      }

      const { proto: targetProto } = parseDancerId(neighbor.dancerId);
      const target = dancerPosition(neighbor.dancerId, prev.dancers);

      // Assert roughly opposite direction (<0.5 rad)
      const angle = angleBetweenFacings(d.facing, target.facing);
      if (Math.abs(angle - Math.PI) >= 0.5) {
        throw new Error(
          `long_waves: ${id} and ${neighbor.dancerId} are not facing roughly opposite directions (angle between facings: ${angle.toFixed(2)} rad, expected ~π)`,
        );
      }

      // Assert roughly same x-coordinate (<0.5m)
      if (Math.abs(d.pos.x - target.pos.x) >= 0.5) {
        throw new Error(
          `long_waves: ${id} and ${neighbor.dancerId} don't have roughly the same x-coordinate (Δx = ${Math.abs(d.pos.x - target.pos.x).toFixed(2)}m)`,
        );
      }

      // Assert opposite role
      if (isLark(id) === isLark(targetProto)) {
        throw new Error(
          `long_waves: ${id} and ${targetProto} have the same role`,
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

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: newHands,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateLongWaves(_prev: Keyframe, _final: FinalKeyframe, _instr: Extract<AtomicInstruction, { type: 'long_waves' }>, _scope: Set<ProtoDancerId>): Keyframe[] {
  return [];
}
