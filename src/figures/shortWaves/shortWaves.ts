import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { makeDancerId, parseDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, isLark } from '../../generateUtils';

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

function findNeighborOnSide(
  id: ProtoDancerId,
  side: 'left' | 'right',
  dancers: Record<ProtoDancerId, import('../../types').DancerState>,
): { dancerId: DancerId; dist: number } | null {
  const d = dancers[id];
  // "right" in dancer-relative coords: rotate facing 90° CW → (facing.y, -facing.x)
  // "left" → (-facing.y, facing.x)
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

      // Check that target is on the correct side (positive dot product with side vector)
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
  // Angle between two unit vectors
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

    for (const side of ['left', 'right'] as const) {
      const neighbor = findNeighborOnSide(id, side, prev.dancers);
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
