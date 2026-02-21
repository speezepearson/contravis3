import type { Relationship, RelativeDirection, DancerState, ProtoDancerId, DancerId } from './types';
import { makeDancerId, parseDancerId, dancerPosition, ProtoDancerIdSchema, buildDancerRecord, NORTH, EAST, SOUTH, QUARTER_CW, HALF_CW, FULL_CW, QUARTER_CCW, normalizeBearing } from './types';
import { assertNever } from './utils';

export const PROTO_DANCER_IDS = ProtoDancerIdSchema.options;

const UPS = new Set<ProtoDancerId>(['up_lark_0', 'up_robin_0']);

const STATIC_RELATIONSHIPS: Record<'partner' | 'neighbor' | 'opposite', Record<ProtoDancerId, ProtoDancerId>> = {
  partner:  { up_lark_0: 'up_robin_0', up_robin_0: 'up_lark_0', down_lark_0: 'down_robin_0', down_robin_0: 'down_lark_0' },
  neighbor: { up_lark_0: 'down_robin_0', up_robin_0: 'down_lark_0', down_lark_0: 'up_robin_0', down_robin_0: 'up_lark_0' },
  opposite: { up_lark_0: 'down_lark_0', up_robin_0: 'down_robin_0', down_lark_0: 'up_lark_0', down_robin_0: 'up_robin_0' },
};

export const SPLIT_GROUPS: Record<'role' | 'position', [Set<ProtoDancerId>, Set<ProtoDancerId>]> = {
  role:     [new Set(['up_lark_0', 'down_lark_0']), new Set(['up_robin_0', 'down_robin_0'])],
  position: [new Set(['up_lark_0', 'up_robin_0']), new Set(['down_lark_0', 'down_robin_0'])],
};

export const ALL_DANCERS = new Set<ProtoDancerId>(PROTO_DANCER_IDS);

export function copyDancers(dancers: Record<ProtoDancerId, DancerState>): Record<ProtoDancerId, DancerState> {
  return buildDancerRecord(id => {
    const d = dancers[id];
    return { x: d.x, y: d.y, facing: d.facing };
  });
}

/** Resolve a relationship from a specific dancer's perspective.
 *  Returns the DancerId of the target, which may be in an adjacent hands-four. */
export function resolveRelationship(relationship: Relationship, id: ProtoDancerId, dancers: Record<ProtoDancerId, DancerState>): DancerId {
  switch (relationship) {
    case 'partner': case 'neighbor': case 'opposite':
      return makeDancerId(STATIC_RELATIONSHIPS[relationship][id], 0);
    case 'on_right': case 'on_left': case 'in_front':
    case 'larks_left_robins_right': case 'larks_right_robins_left': {
      const isLark = SPLIT_GROUPS.role[0].has(id);
      const angleOffset =
        relationship === 'on_right' ? 70 * Math.PI / 180 :
        relationship === 'on_left' ? -70 * Math.PI / 180 :
        relationship === 'in_front' ? 0 :
        relationship === 'larks_left_robins_right' ? (isLark ? -70 * Math.PI / 180 : 70 * Math.PI / 180) :
        relationship === 'larks_right_robins_left' ? (isLark ? 70 * Math.PI / 180 : -70 * Math.PI / 180) :
        assertNever(relationship);
      const d = dancers[id];
      const headingRad = d.facing + angleOffset;
      const ux = Math.sin(headingRad);
      const uy = Math.cos(headingRad);

      let bestScore = Infinity;
      let bestTarget: DancerId | null = null;

      for (const otherId of PROTO_DANCER_IDS) {
        if (otherId === id) continue;
        const dyBase = dancers[otherId].y - d.y;
        const oBest = Math.round(-dyBase / 2);
        for (let o = oBest - 2; o <= oBest + 2; o++) {
          const targetId = makeDancerId(otherId, o);
          const targetPos = dancerPosition(targetId, dancers);
          const dx = targetPos.x - d.x;
          const dy = targetPos.y - d.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r > 1.2 || r < 1e-9) continue;

          const cosTheta = (ux * dx + uy * dy) / r;
          if (cosTheta < 0) continue;
          const cos2Theta = 2 * cosTheta * cosTheta - 1;
          if (cos2Theta < 0.01) continue;

          const score = r / cos2Theta;
          if (score < bestScore) {
            bestScore = score;
            bestTarget = targetId;
          }
        }
      }

      if (bestTarget === null) {
        throw new Error(`resolveRelationship: no valid candidate for '${relationship}' from ${id}`);
      }
      return bestTarget;
    }
    default: return assertNever(relationship);
  }
}

/** Resolve a relationship for all scoped dancers, returning a Map from each
 *  proto-dancer to its target DancerId.
 *  Asserts that pairs are symmetric, target protos are in scope, and
 *  (optionally) paired dancers have same/different roles. */
export function resolvePairs(
  relationship: Relationship,
  dancers: Record<ProtoDancerId, DancerState>,
  scope: Set<ProtoDancerId>,
  { pairRoles }: { pairRoles?: "same" | "different" },
): Map<ProtoDancerId, DancerId> {
  const result = new Map<ProtoDancerId, DancerId>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    result.set(id, resolveRelationship(relationship, id, dancers));
  }

  const [larks] = SPLIT_GROUPS.role;
  for (const [id, targetDancerId] of result) {
    const { proto: targetProto } = parseDancerId(targetDancerId);

    if (!scope.has(targetProto)) {
      throw new Error(
        `${id}'s ${relationship} resolves to ${targetDancerId}, whose proto ${targetProto} is not in scope`,
      );
    }

    const reverseTarget = result.get(targetProto);
    if (reverseTarget === undefined) {
      throw new Error(
        `${relationship} is not symmetric: ${id} → ${targetProto} but ${targetProto} has no resolution`,
      );
    }
    if (parseDancerId(reverseTarget).proto !== id) {
      throw new Error(
        `${relationship} is not symmetric: ${id} → ${targetProto} but ${targetProto} → ${parseDancerId(reverseTarget).proto}`,
      );
    }

    if (pairRoles === "same" && larks.has(id) !== larks.has(targetProto)) {
      throw new Error(
        `expected same roles, but ${id} and ${targetProto} have different roles`,
      );
    }
    if (pairRoles === "different" && larks.has(id) === larks.has(targetProto)) {
      throw new Error(
        `expected opposite roles, but ${id} and ${targetProto} are both ${larks.has(id) ? "larks" : "robins"}`,
      );
    }
  }

  return result;
}

export function easeInOut(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

/** Position on an ellipse whose major axis runs from `a` to `b`.
 *  phi=0 → a, phi=π → b, phi=2π → a again. */
export function ellipsePosition(
  a: { x: number; y: number },
  b: { x: number; y: number },
  semiMinor: number,
  phi: number,
): { x: number; y: number } {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dx = a.x - cx;
  const dy = a.y - cy;
  const semiMajor = Math.hypot(dx, dy);
  if (semiMajor < 1e-9) return { x: cx, y: cy };
  const sinStart = dx / semiMajor;
  const cosStart = dy / semiMajor;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  return {
    x: cx + semiMajor * cosPhi * sinStart + semiMinor * sinPhi * cosStart,
    y: cy + semiMajor * cosPhi * cosStart - semiMinor * sinPhi * sinStart,
  };
}

/** Resolve a RelativeDirection to an absolute heading in radians for a specific dancer.
 *  Uses atan2(dx,dy) convention: 0 = +y (north/up on screen). */
export function resolveHeading(dir: RelativeDirection, d: DancerState, id: ProtoDancerId, dancers: Record<ProtoDancerId, DancerState>): number {
  if (dir.kind === 'direction') {
    switch (dir.value) {
      case 'up':               return NORTH;
      case 'down':             return SOUTH;
      case 'across':           return d.x < 0 ? EAST : -EAST;
      case 'out':              return d.x < 0 ? -EAST : EAST;
      case 'progression':      return UPS.has(id) ? NORTH : SOUTH;
      case 'forward':          return d.facing;
      case 'back':             return d.facing + HALF_CW;
      case 'right':            return d.facing + QUARTER_CW;
      case 'left':             return d.facing + QUARTER_CCW;
    }
  }
  // relationship: toward the matched partner
  const targetDancerId = resolveRelationship(dir.value, id, dancers);
  const t = dancerPosition(targetDancerId, dancers);
  return Math.atan2(t.x - d.x, t.y - d.y);
}

/** Resolve a RelativeDirection to an absolute facing in radians. */
export function resolveFacing(dir: RelativeDirection, d: DancerState, id: ProtoDancerId, dancers: Record<ProtoDancerId, DancerState>): number {
  return normalizeBearing(resolveHeading(dir, d, id, dancers));
}

/** Determine a dancer's inside hand (the hand closer to the target).
 *  Throws if the target is directly in front of or behind the dancer. */
export function resolveInsideHand(dancer: DancerState, target: DancerState): 'left' | 'right' {
  const heading = Math.atan2(target.x - dancer.x, target.y - dancer.y);
  const rel = ((heading - dancer.facing + 3 * Math.PI) % FULL_CW) - Math.PI;
  if (Math.abs(rel) < 1e-9 || Math.abs(Math.abs(rel) - Math.PI) < 1e-9) {
    throw new Error('Cannot determine inside hand: target is neither to the left nor to the right');
  }
  return rel > 0 ? 'right' : 'left';
}

/** Determine a dancer's inside hand toward a neighbor in a ring where dancers face center.
 *  Uses the cross product of facing direction and direction to target.
 *  Falls back on angular ordering when they are directly in front/behind. */
export function insideHandInRing(dancer: DancerState, target: DancerState, dancerAngle: number, targetAngle: number): 'left' | 'right' {
  const fx = Math.sin(dancer.facing);
  const fy = Math.cos(dancer.facing);
  const dx = target.x - dancer.x;
  const dy = target.y - dancer.y;
  const cross = fx * dy - fy * dx;
  if (Math.abs(cross) > 1e-9) {
    return cross < 0 ? 'right' : 'left';
  }
  let angleDiff = targetAngle - dancerAngle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  return angleDiff > 0 ? 'right' : 'left';
}

export function isLark(id: ProtoDancerId): boolean {
  return id === 'up_lark_0' || id === 'down_lark_0';
}
