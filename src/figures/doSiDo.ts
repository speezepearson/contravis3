import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { dancerPosition } from '../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs } from '../generateUtils';

export function generateDoSiDo(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'do_si_do' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  // Like allemande but dancers maintain original facing and no hand connections
  const totalAngleRad = instr.rotations * 2 * Math.PI; // always CW (pass right shoulders)
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});
  const orbitData: {
    protoId: ProtoDancerId;
    startPos: { x: number; y: number };
    partnerPos: { x: number; y: number };
    semiMinor: number;
    originalFacing: number;
  }[] = [];
  for (const [id, target] of pairs) {
    const da = prev.dancers[id];
    const partnerPos = dancerPosition(target, prev.dancers);
    const dist = Math.hypot(da.x - partnerPos.x, da.y - partnerPos.y);
    orbitData.push({
      protoId: id,
      startPos: { x: da.x, y: da.y },
      partnerPos: { x: partnerPos.x, y: partnerPos.y },
      semiMinor: dist / 4,
      originalFacing: da.facing,
    });
  }

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const phase = tEased * totalAngleRad;
    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      const pos = ellipsePosition(od.startPos, od.partnerPos, od.semiMinor, phase);
      dancers[od.protoId].x = pos.x;
      dancers[od.protoId].y = pos.y;
      dancers[od.protoId].facing = od.originalFacing;
    }
    result.push({ beat, dancers, hands: prev.hands });
  }
  return result;
}
