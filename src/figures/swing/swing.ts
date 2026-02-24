import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection } from '../../types';
import { Vector, makeDancerId, parseDancerId, headingAngle, headingVector, makeFinalKeyframe } from '../../types';
import { copyDancers, resolveFacing, resolvePairs, isLark } from '../../generateUtils';

const FRONT = 0.15;
const RIGHT = 0.1;
// Phase offset: angle from CoM to lark (in heading convention) when lark faces 0°
const PHASE_OFFSET = Math.PI + Math.atan2(RIGHT, FRONT);

type SwingPair = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
  center: Vector;
  f0: number;
  omega: number;
  endFacing: Vector;
  phase2Start: number;
  phase2Duration: number;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>) {
  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });

  const pairs: SwingPair[] = [];
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

    const larkDelta = larkState.pos.subtract(center);
    const thetaLark = Math.atan2(larkDelta.x, larkDelta.y);
    const f0 = thetaLark - PHASE_OFFSET;

    const endFacing = resolveFacing(instr.endFacing, larkState, lark, prev.dancers);

    const baseRotation = (Math.PI / 2) * instr.beats;
    const neededRads = headingAngle(endFacing) - f0;
    const nRots = Math.round((baseRotation - neededRads) / (2 * Math.PI));
    const totalRotation = neededRads + nRots * 2 * Math.PI;
    const omega = totalRotation / instr.beats;

    const phase2Duration = (Math.PI / 2) / omega;
    const phase2Start = instr.beats - phase2Duration;

    pairs.push({ lark, robin, center, f0, omega, endFacing, phase2Start, phase2Duration });
  }

  const swingHands: HandConnection[] = [];
  for (const { lark, robin } of pairs) {
    swingHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'left' });
  }

  return { pairs, processed, swingHands };
}

export function finalSwing(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs, swingHands } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const { lark, robin, center, endFacing } of pairs) {
    // Lark position: 0.5m to the left of CoM (from lark's perspective facing endFacing)
    dancers[lark].pos = center.add(endFacing.multiply(0.5).rotateByDegrees(90));
    dancers[lark].facing = endFacing;

    // Robin: 1.0m to lark's right, facing same direction
    dancers[robin].pos = dancers[lark].pos.add(endFacing.multiply(1.0).rotateByDegrees(-90));
    dancers[robin].facing = endFacing;
  }

  // Swing hands are dropped at the end
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: swingHands,
  });
}

export function generateSwing(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  const { pairs, swingHands } = setup(prev, instr, scope);

  return (t: number) => {
    const beat = prev.beat + t * instr.beats;
    const elapsed = t * instr.beats;
    const dancers = copyDancers(prev.dancers);

    for (const pair of pairs) {
      const { lark, robin, center, f0, omega, endFacing, phase2Start, phase2Duration } = pair;
      const larkFacingRad = f0 + omega * elapsed;

      if (elapsed <= phase2Start) {
        // Phase 1: regular swing orbit
        dancers[lark].pos = center.add(
          new Vector(-RIGHT, -FRONT).rotateByRadians(-larkFacingRad)
        );
        dancers[lark].facing = headingVector(larkFacingRad);

        const robinFacingRad = larkFacingRad + Math.PI;
        dancers[robin].pos = center.add(
          new Vector(RIGHT, FRONT).rotateByRadians(-larkFacingRad)
        );
        dancers[robin].facing = headingVector(robinFacingRad);
      } else {
        // Phase 2: lark has 90° of rotation left
        const tLocal = (elapsed - phase2Start) / phase2Duration;

        const fP1End = f0 + omega * phase2Start;
        const larkP1End = center.add(
          new Vector(-RIGHT, -FRONT).rotateByRadians(fP1End)
        );

        const larkFinal = center.add(endFacing.multiply(0.5).rotateByDegrees(90));

        dancers[lark].pos = larkP1End.add(larkFinal.subtract(larkP1End).multiply(tLocal));
        dancers[lark].facing = headingVector(larkFacingRad);

        const robinFacingRad = larkFacingRad + Math.PI * (1 + tLocal);
        dancers[robin].facing = headingVector(robinFacingRad);

        const robinFront = 0.3 * (1 - tLocal);
        const robinRight = 0.2 + 0.8 * tLocal;

        dancers[robin].pos = dancers[lark].pos.add(
          new Vector(robinRight, robinFront).rotateByRadians(-larkFacingRad)
        );
      }
    }

    return { beat, dancers, hands: swingHands };
  };
}
