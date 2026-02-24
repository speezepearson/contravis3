import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { makeFinalKeyframe, headingAngle, headingVector, ccwRadsBetween } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, easeInOut, resolveHeading, resolveFacing } from '../../generateUtils';

export function finalStep(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'step' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const dancers = copyDancers(prev.dancers);
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    const heading = resolveHeading(instr.direction, d, id, prev.dancers);
    dancers[id].pos = d.pos.add(heading.multiply(instr.distance));
    const base = resolveFacing(instr.facing, d, id, prev.dancers);
    // offset is CW radians; vecti rotateByRadians is CCW, so negate
    dancers[id].facing = base.rotateByRadians(-instr.facingOffset);
  }
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  });
}

export function generateStep(prev: Keyframe, final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'step' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const keyframes: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(prev.dancers);
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      dancers[id].pos = prev.dancers[id].pos.add(
        final.dancers[id].pos.subtract(prev.dancers[id].pos).multiply(tEased),
      );
      dancers[id].facing = prev.dancers[id].facing.rotateByRadians(ccwRadsBetween(prev.dancers[id].facing, final.dancers[id].facing) * tEased);
    }
    keyframes.push({ beat, dancers, hands: prev.hands });
  }
  return keyframes;
}
