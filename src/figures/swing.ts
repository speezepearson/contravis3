import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { Vector, makeDancerId, parseDancerId, headingAngle, headingVector, makeFinalKeyframe } from '../types';
import { copyDancers, resolveFacing, resolvePairs, isLark } from '../generateUtils';

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
  endFacingRad: number;
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

    const endFacingRad = headingAngle(resolveFacing(instr.endFacing, larkState, lark, prev.dancers));

    const baseRotation = (Math.PI / 2) * instr.beats;
    const needed = endFacingRad - f0;
    const n = Math.round((baseRotation - needed) / (2 * Math.PI));
    const totalRotation = needed + n * 2 * Math.PI;
    const omega = totalRotation / instr.beats;

    const phase2Duration = (Math.PI / 2) / omega;
    const phase2Start = instr.beats - phase2Duration;

    pairs.push({ lark, robin, center, f0, omega, endFacingRad, phase2Start, phase2Duration });
  }

  // Hands not involving swing participants
  const nonParticipantHands = prev.hands.filter(h =>
    !processed.has(parseDancerId(h.a).proto) && !processed.has(parseDancerId(h.b).proto)
  );
  // Swing hands: non-participant + lark-right ↔ robin-left
  const swingHands = [...nonParticipantHands];
  for (const { lark, robin } of pairs) {
    swingHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'left' });
  }

  return { pairs, processed, nonParticipantHands, swingHands };
}

export function finalSwing(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs, nonParticipantHands } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const { lark, robin, center, endFacingRad } of pairs) {
    // Lark position: 0.5m to the left of CoM (from lark's perspective facing endFacing)
    dancers[lark].pos = new Vector(
      center.x - 0.5 * Math.cos(endFacingRad),
      center.y + 0.5 * Math.sin(endFacingRad),
    );
    dancers[lark].facing = headingVector(endFacingRad);

    // Robin: 1.0m to lark's right, facing same direction
    dancers[robin].pos = new Vector(
      dancers[lark].pos.x + 1.0 * Math.cos(endFacingRad),
      dancers[lark].pos.y - 1.0 * Math.sin(endFacingRad),
    );
    dancers[robin].facing = headingVector(endFacingRad);
  }

  // Swing hands are dropped at the end
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: nonParticipantHands,
  });
}

export function generateSwing(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { pairs, swingHands } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const result: Keyframe[] = [];

  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const elapsed = t * instr.beats;

    const dancers = copyDancers(prev.dancers);

    for (const pair of pairs) {
      const { lark, robin, center, f0, omega, endFacingRad, phase2Start, phase2Duration } = pair;

      const larkFacingRad = f0 + omega * elapsed;

      if (elapsed <= phase2Start) {
        // Phase 1: regular swing orbit
        dancers[lark].pos = new Vector(
          center.x - FRONT * Math.sin(larkFacingRad) - RIGHT * Math.cos(larkFacingRad),
          center.y - FRONT * Math.cos(larkFacingRad) + RIGHT * Math.sin(larkFacingRad),
        );
        dancers[lark].facing = headingVector(larkFacingRad);

        const robinFacingRad = larkFacingRad + Math.PI;
        dancers[robin].pos = new Vector(
          center.x + FRONT * Math.sin(larkFacingRad) + RIGHT * Math.cos(larkFacingRad),
          center.y + FRONT * Math.cos(larkFacingRad) - RIGHT * Math.sin(larkFacingRad),
        );
        dancers[robin].facing = headingVector(robinFacingRad);
      } else {
        // Phase 2: lark has 90° of rotation left
        const tLocal = (elapsed - phase2Start) / phase2Duration;

        const fP1End = f0 + omega * phase2Start;
        const larkP1End = new Vector(
          center.x - FRONT * Math.sin(fP1End) - RIGHT * Math.cos(fP1End),
          center.y - FRONT * Math.cos(fP1End) + RIGHT * Math.sin(fP1End),
        );

        const larkFinal = new Vector(
          center.x - 0.5 * Math.cos(endFacingRad),
          center.y + 0.5 * Math.sin(endFacingRad),
        );

        dancers[lark].pos = larkP1End.add(larkFinal.subtract(larkP1End).multiply(tLocal));
        dancers[lark].facing = headingVector(larkFacingRad);

        const robinFacingRad = larkFacingRad + Math.PI * (1 + tLocal);
        dancers[robin].facing = headingVector(robinFacingRad);

        const robinFront = 0.3 * (1 - tLocal);
        const robinRight = 0.2 + 0.8 * tLocal;

        dancers[robin].pos = new Vector(
          dancers[lark].pos.x + robinFront * Math.sin(larkFacingRad) + robinRight * Math.cos(larkFacingRad),
          dancers[lark].pos.y + robinFront * Math.cos(larkFacingRad) - robinRight * Math.sin(larkFacingRad),
        );
      }
    }

    result.push({ beat, dancers, hands: swingHands });
  }

  return result;
}
