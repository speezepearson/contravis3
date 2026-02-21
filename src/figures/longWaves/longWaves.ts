import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { makeDancerId, parseDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, isLark } from '../../generateUtils';

/**
 * Long waves: 0-beat assertion figure.
 *
 * For every dancer in scope:
 * - Assert there's somebody on your right; assert they face roughly the opposite
 *   direction (<0.5 rad); assert roughly the same x-coordinate (<0.5m); assert
 *   opposite role; take inside hands.
 * - Same for the person on your left.
 */

function findNeighborOnSide(
  id: ProtoDancerId,
  side: 'left' | 'right',
  dancers: Record<ProtoDancerId, import('../../types').DancerState>,
): { dancerId: DancerId; dist: number } | null {
  const d = dancers[id];
  const sideVec = side === 'right'
    ? { x: d.facing.y, y: -d.facing.x }
    : { x: -d.facing.y, y: d.facing.x };

  let best: { dancerId: DancerId; dist: number } | null = null;

  for (const otherId of PROTO_DANCER_IDS) {
    if (otherId === id) continue;
    const dyBase = dancers[otherId].pos.y - d.pos.y;
    const oBest = Math.round(-dyBase / 2);
    for (let o = oBest - 2; o <= oBest + 2; o++) {
      const targetId = makeDancerId(otherId, o);
      const target = dancerPosition(targetId, dancers);
      const dx = target.pos.x - d.pos.x;
      const dy = target.pos.y - d.pos.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 1e-9 || r > 1.5) continue;

      const dot = sideVec.x * dx + sideVec.y * dy;
      if (dot <= 1e-9) continue;

      if (!best || r < best.dist) {
        best = { dancerId: targetId, dist: r };
      }
    }
  }

  return best;
}

function angleBetweenFacings(a: import('../../types').Vector, b: import('../../types').Vector): number {
  const dot = a.x * b.x + a.y * b.y;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function resolveInsideHand(
  dancer: import('../../types').DancerState,
  target: import('../../types').DancerState,
): 'left' | 'right' {
  const delta = target.pos.subtract(dancer.pos);
  const cross = dancer.facing.x * delta.y - dancer.facing.y * delta.x;
  if (Math.abs(cross) < 1e-9) {
    throw new Error('Cannot determine inside hand: target is neither to the left nor to the right');
  }
  return cross < 0 ? 'right' : 'left';
}

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
