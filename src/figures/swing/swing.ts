import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { Vector, headingAngle, makeFinalKeyframe, dancerPosition, ccwRadsBetween } from '../../types';
import { copyDancers, resolveFacing, resolvePairs, isLark } from '../../generateUtils';

const FRONT = 0.15;
const RIGHT = 0.1;
// Phase offset: angle from CoM to lark (in heading convention) when lark faces 0°
const PHASE_OFFSET = ccwRadsBetween(new Vector(1, 0), new Vector(FRONT, -RIGHT));

type SwingPair = {
  proto: ProtoDancerId;
  foil: DancerId;
  center: Vector;
  initOffsetFromCenter: Vector;
  omega: number;
  endFacing: Vector;
  phase2Start: number;
  phase2Duration: number;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>) {
  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });

  const pairs: SwingPair[] = [];

  for (const [proto, foil] of pairMap) {

    const protoState = dancerPosition(proto, prev.dancers);
    const foilState = dancerPosition(foil, prev.dancers);
    const center = protoState.pos.add(foilState.pos).multiply(0.5);

    const larkDelta = protoState.pos.subtract(center);
    const thetaLark = Math.atan2(larkDelta.x, larkDelta.y);
    const f0 = thetaLark - PHASE_OFFSET;

    const initOffsetFromCenter = protoState.pos.subtract(center);
    const endFacing = resolveFacing(instr.endFacing, protoState, proto, prev.dancers);

    const baseRotation = (Math.PI / 2) * instr.beats;
    const neededRads = headingAngle(endFacing) - f0;
    const nRots = Math.round((baseRotation - neededRads) / (2 * Math.PI));
    const totalRotation = neededRads + nRots * 2 * Math.PI;
    const omega = totalRotation / instr.beats;

    const phase2Duration = (Math.PI / 2) / omega;
    const phase2Start = instr.beats - phase2Duration;

    pairs.push({ proto, foil, center, initOffsetFromCenter, omega, endFacing, phase2Start, phase2Duration });
  }

  const swingHands: HandConnection[] = [];
  for (const { proto, foil } of pairs) {
    swingHands.push({ a: proto, ha: 'right', b: foil, hb: 'left' });
  }

  return { pairs, swingHands };
}

export function finalSwing(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs, swingHands } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const { proto, center, endFacing } of pairs) {
    dancers[proto].pos = center.add(endFacing.multiply(0.5).rotateByDegrees(isLark(proto) ? 90 : -90));
    dancers[proto].facing = endFacing;
  }

  // Swing hands are dropped at the end
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: swingHands,
  });
}

export function generateSwing(_prev: Keyframe, _final: FinalKeyframe, _instr: Extract<AtomicInstruction, { type: 'swing' }>, _scope: Set<ProtoDancerId>): Keyframe[] {
  throw new Error('not implemented');
}
