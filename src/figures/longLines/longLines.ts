import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { Vector, makeDancerId, parseDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, isLark, easeInOut } from '../../generateUtils';

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

function assertAndTakeHands(
  prev: Keyframe,
  scope: Set<ProtoDancerId>,
): HandConnection[] {
  const newHands: HandConnection[] = [...prev.hands];
  const seen = new Set<string>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];

    for (const side of ['left', 'right'] as const) {
      const neighbor = findNeighborOnSide(id, side, prev.dancers);
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

export function generateLongLines(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'long_lines' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const hands = assertAndTakeHands(prev, scope);
  const halfBeats = instr.beats / 2;
  const nFramesPerHalf = Math.max(1, Math.round(halfBeats / 0.25));

  // Compute "forward" (middle) positions: each dancer moves to x=±0.2
  // keeping their y and facing
  const middleDancers = copyDancers(prev.dancers);
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const sign = middleDancers[id].pos.x < 0 ? -1 : 1;
    middleDancers[id].pos = new Vector(sign * 0.2, middleDancers[id].pos.y);
  }

  const result: Keyframe[] = [];

  // Phase 1: step toward middle
  for (let i = 1; i < nFramesPerHalf; i++) {
    const t = i / nFramesPerHalf;
    const beat = prev.beat + t * halfBeats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(prev.dancers);
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      dancers[id].pos = prev.dancers[id].pos.add(
        middleDancers[id].pos.subtract(prev.dancers[id].pos).multiply(tEased),
      );
    }
    result.push({ beat, dancers, hands });
  }

  // Midpoint keyframe
  const midKf: Keyframe = { beat: prev.beat + halfBeats, dancers: middleDancers, hands };
  result.push(midKf);

  // Phase 2: step back out
  for (let i = 1; i < nFramesPerHalf; i++) {
    const t = i / nFramesPerHalf;
    const beat = prev.beat + halfBeats + t * halfBeats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(middleDancers);
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      dancers[id].pos = middleDancers[id].pos.add(
        prev.dancers[id].pos.subtract(middleDancers[id].pos).multiply(tEased),
      );
    }
    result.push({ beat, dancers, hands });
  }

  return result;
}
