import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { makeDancerId, parseDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, isLark, resolveInsideHand, findDancerOnSide, angleBetweenFacings } from '../../generateUtils';

/**
 * Short waves: 0-beat assertion figure.
 *
 * For every dancer in scope:
 * - If there's somebody on your left: take inside hands; assert they face roughly
 *   the opposite direction (<0.5 rad); assert roughly the same y-coordinate (<0.5m).
 * - Same for the person on your right.
 * - If you're holding hands with exactly one other person, assert they're the
 *   opposite role.
 */

export function finalShortWaves(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'short_waves' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const newHands: HandConnection[] = [...prev.hands];
  const seen = new Set<string>();

  // Track how many new hand connections each dancer gets
  const handCount = new Map<ProtoDancerId, DancerId[]>();
  for (const id of PROTO_DANCER_IDS) {
    if (scope.has(id)) handCount.set(id, []);
  }

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];

    for (const side of ['on_left', 'on_right'] as const) {
      const neighbor = findDancerOnSide(id, side, prev.dancers);
      if (!neighbor) continue;

      const target = dancerPosition(neighbor.dancerId, prev.dancers);

      // Assert roughly opposite direction (<0.5 rad)
      const angle = angleBetweenFacings(d.facing, target.facing);
      if (Math.abs(angle - Math.PI) >= 0.5) {
        throw new Error(
          `short_waves: ${id} and ${neighbor.dancerId} are not facing roughly opposite directions (angle between facings: ${angle.toFixed(2)} rad, expected ~π)`,
        );
      }

      // Assert roughly same y-coordinate (<0.5m)
      if (Math.abs(d.pos.y - target.pos.y) >= 0.5) {
        throw new Error(
          `short_waves: ${id} and ${neighbor.dancerId} don't have roughly the same y-coordinate (Δy = ${Math.abs(d.pos.y - target.pos.y).toFixed(2)}m)`,
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

      const { proto: targetProto } = parseDancerId(neighbor.dancerId);
      handCount.get(id)?.push(neighbor.dancerId);
      if (scope.has(targetProto)) {
        handCount.get(targetProto)?.push(makeDancerId(id, 0));
      }
    }
  }

  // If holding hands with exactly one person, assert opposite role
  for (const [id, partners] of handCount) {
    // Deduplicate partners
    const uniqueProtos = new Set(partners.map(p => parseDancerId(p).proto));
    if (uniqueProtos.size === 1) {
      const partnerProto = [...uniqueProtos][0];
      if (isLark(id) === isLark(partnerProto)) {
        throw new Error(
          `short_waves: ${id} is holding hands with exactly one person (${partnerProto}), but they have the same role`,
        );
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
export function generateShortWaves(_prev: Keyframe, _final: FinalKeyframe, _instr: Extract<AtomicInstruction, { type: 'short_waves' }>, _scope: Set<ProtoDancerId>): Keyframe[] {
  return [];
}
