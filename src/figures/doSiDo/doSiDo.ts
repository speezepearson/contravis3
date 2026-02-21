import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { type Vector, dancerPosition, makeFinalKeyframe } from '../../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs } from '../../generateUtils';

type OrbitDatum = {
  protoId: ProtoDancerId;
  startPos: Vector;
  partnerPos: Vector;
  semiMinor: number;
  originalFacing: Vector;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'do_si_do' }>, scope: Set<ProtoDancerId>) {
  const totalAngleRad = instr.rotations * 2 * Math.PI; // always CW (pass right shoulders)
  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});

  const orbitData: OrbitDatum[] = [];
  for (const [id, target] of pairs) {
    const da = prev.dancers[id];
    const partnerState = dancerPosition(target, prev.dancers);
    const dist = da.pos.subtract(partnerState.pos).length();
    orbitData.push({
      protoId: id,
      startPos: da.pos,
      partnerPos: partnerState.pos,
      semiMinor: dist / 4,
      originalFacing: da.facing,
    });
  }

  return { totalAngleRad, orbitData };
}

export function finalDoSiDo(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'do_si_do' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { totalAngleRad, orbitData } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const od of orbitData) {
    dancers[od.protoId].pos = ellipsePosition(od.startPos, od.partnerPos, od.semiMinor, totalAngleRad);
    dancers[od.protoId].facing = od.originalFacing;
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  });
}

export function generateDoSiDo(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'do_si_do' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { totalAngleRad, orbitData } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const phase = tEased * totalAngleRad;
    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      dancers[od.protoId].pos = ellipsePosition(od.startPos, od.partnerPos, od.semiMinor, phase);
      dancers[od.protoId].facing = od.originalFacing;
    }
    result.push({ beat, dancers, hands: prev.hands });
  }
  return result;
}
