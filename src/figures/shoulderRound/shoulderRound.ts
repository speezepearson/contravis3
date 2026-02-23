import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { Vector, parseDancerId, headingAngle, headingVector, makeFinalKeyframe, NORTH, SOUTH, EAST, WEST } from '../../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs, isLark } from '../../generateUtils';

type ShoulderPair = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
  center: Vector;
  dist: number;
  larkAngle0: number; // heading angle of lark-from-center
};

function resolveEndFacing(endFacing: string, id: ProtoDancerId, pos: Vector): Vector {
  const lark = isLark(id);
  switch (endFacing) {
    case 'larks_up_robins_down': return lark ? NORTH : SOUTH;
    case 'larks_down_robins_up': return lark ? SOUTH : NORTH;
    case 'larks_across_robins_out': return lark ? (pos.x < 0 ? EAST : WEST) : (pos.x < 0 ? WEST : EAST);
    case 'larks_out_robins_across': return lark ? (pos.x < 0 ? WEST : EAST) : (pos.x < 0 ? EAST : WEST);
    default: throw new Error(`Unknown shoulder_round endFacing: ${endFacing}`);
  }
}

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'shoulder_round' }>, scope: Set<ProtoDancerId>) {
  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });
  const lateralSign = instr.handedness === 'right' ? 1 : -1;

  const pairs: ShoulderPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const [id] of pairMap) {
    if (processed.has(id)) continue;
    const targetId = pairMap.get(id)!;
    const { proto: targetProto } = parseDancerId(targetId);

    const lark = isLark(id) ? id : targetProto;
    const robin = isLark(id) ? targetProto : id;
    processed.add(lark);
    processed.add(robin);

    const larkState = prev.dancers[lark];
    const robinState = prev.dancers[robin];
    const center = larkState.pos.add(robinState.pos).multiply(0.5);
    const dist = larkState.pos.subtract(robinState.pos).length();

    // Angle of lark from center in heading convention
    const larkDelta = larkState.pos.subtract(center);
    const larkAngle0 = Math.atan2(larkDelta.x, larkDelta.y);

    pairs.push({ lark, robin, center, dist, larkAngle0 });
  }

  return { pairs, lateralSign };
}

export function finalShoulderRound(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'shoulder_round' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  const separation = 0.5;

  for (const { lark, robin, center } of pairs) {
    // Compute end facing for lark to determine final positions
    // We need final positions first to resolve facing, but facing depends on position for across/out.
    // Use center position as a proxy for the side-of-set determination.
    const larkFacing = resolveEndFacing(instr.endFacing, lark, center);
    const robinFacing = resolveEndFacing(instr.endFacing, robin, center);

    // Lark and robin end 0.5m apart, same center of mass
    // They need to be on each other's [right/left] based on handedness
    // "on each other's right" means from lark's perspective, robin is to his right
    // lark's right is perpendicular CW from his facing
    const larkFacingRad = headingAngle(larkFacing);
    // Right of lark: (sin(f+pi/2), cos(f+pi/2)) = (cos(f), -sin(f))
    // But "on each other's right" with handedness=right means robin is on lark's right
    const sideSign = instr.handedness === 'right' ? 1 : -1;
    const perpX = sideSign * Math.cos(larkFacingRad);
    const perpY = sideSign * -Math.sin(larkFacingRad);

    dancers[lark].pos = new Vector(
      center.x - (separation / 2) * perpX,
      center.y - (separation / 2) * perpY,
    );
    dancers[robin].pos = new Vector(
      center.x + (separation / 2) * perpX,
      center.y + (separation / 2) * perpY,
    );
    dancers[lark].facing = larkFacing;
    dancers[robin].facing = robinFacing;
  }

  // No hand connections at end
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: [],
  });
}

export function generateShoulderRound(prev: Keyframe, final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'shoulder_round' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { pairs, lateralSign } = setup(prev, instr, scope);
  const totalBeats = instr.beats;
  const nFrames = Math.max(1, Math.round(totalBeats / 0.25));

  // Phase 1: face each other and walk 1/4 ellipse (~1 beat worth, but scaled)
  // Phase 2: revolve around CoM
  // Per spec: ~1 rotation/4 beats, round down to end at correct facing

  // We'll do the approach as:
  // - First 1/4 of the time: approach each other via 1/4 ellipse
  // - Remaining 3/4: revolve around center

  const approachFraction = 0.25;
  const approachBeats = totalBeats * approachFraction;
  const revolveBeats = totalBeats - approachBeats;

  const result: Keyframe[] = [];

  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * totalBeats;
    const elapsed = t * totalBeats;

    const dancers = copyDancers(prev.dancers);

    for (const { lark, robin, dist } of pairs) {
      const larkState = prev.dancers[lark];
      const robinState = prev.dancers[robin];

      if (elapsed <= approachBeats) {
        // Phase 1: face each other, walk 1/4 of the ellipse so they end up
        // on each other's [handedness] side
        const tPhase = elapsed / approachBeats;
        const theta = (Math.PI / 2) * tPhase;

        // Face each other
        const toRobin = robinState.pos.subtract(larkState.pos);
        const facingRad = Math.atan2(toRobin.x, toRobin.y);
        dancers[lark].facing = headingVector(facingRad);
        dancers[robin].facing = headingVector(facingRad + Math.PI);

        // Ellipse with lateralSign determines CW vs CCW path
        dancers[lark].pos = ellipsePosition(larkState.pos, robinState.pos, lateralSign * dist / 4, theta);
        dancers[robin].pos = ellipsePosition(robinState.pos, larkState.pos, lateralSign * dist / 4, theta);
      } else {
        // Phase 2: revolve around center of mass
        // Compute where they are after the approach (1/4 ellipse)
        const approachLark = ellipsePosition(larkState.pos, robinState.pos, lateralSign * dist / 4, Math.PI / 2);
        const approachRobin = ellipsePosition(robinState.pos, larkState.pos, lateralSign * dist / 4, Math.PI / 2);
        const revolveCenter = approachLark.add(approachRobin).multiply(0.5);
        const revolveRadius = approachLark.subtract(revolveCenter).length();

        // Initial angle of lark from revolve center
        const larkRevolveDelta = approachLark.subtract(revolveCenter);
        const larkRevolveAngle0 = Math.atan2(larkRevolveDelta.x, larkRevolveDelta.y);

        const tPhase = (elapsed - approachBeats) / revolveBeats;

        // Compute target angle from final keyframe
        const finalLarkDelta = final.dancers[lark].pos.subtract(revolveCenter);
        const finalLarkAngle = Math.atan2(finalLarkDelta.x, finalLarkDelta.y);

        // Total revolve angle
        // Omega ~ pi/2 per beat (1 rotation per 4 beats)
        const omega = Math.PI / 2;
        const baseAngle = omega * revolveBeats;
        // CW for right shoulder, CCW for left shoulder
        const revolveSign = instr.handedness === 'right' ? 1 : -1;
        const neededAngle = revolveSign * (finalLarkAngle - larkRevolveAngle0);
        const n = Math.round((revolveSign * baseAngle - neededAngle) / (2 * Math.PI));
        const totalAngle = neededAngle + n * 2 * Math.PI;

        const currentAngle = larkRevolveAngle0 + totalAngle * tPhase;
        const robinCurrentAngle = currentAngle + Math.PI;

        dancers[lark].pos = new Vector(
          revolveCenter.x + revolveRadius * Math.sin(currentAngle),
          revolveCenter.y + revolveRadius * Math.cos(currentAngle),
        );
        dancers[robin].pos = new Vector(
          revolveCenter.x + revolveRadius * Math.sin(robinCurrentAngle),
          revolveCenter.y + revolveRadius * Math.cos(robinCurrentAngle),
        );

        // Face tangent to the orbit
        dancers[lark].facing = headingVector(currentAngle + revolveSign * Math.PI / 2);
        dancers[robin].facing = headingVector(robinCurrentAngle + revolveSign * Math.PI / 2);
      }
    }

    result.push({ beat, dancers, hands: [] });
  }

  return result;
}
