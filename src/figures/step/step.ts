import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { makeFinalKeyframe, ccwRadsBetween } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, resolveHeading, resolveFacing } from '../../generateUtils';

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

export function generateStep(prev: Keyframe, final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'step' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  return (t: number) => {
    const beat = prev.beat + t * instr.beats;
    const dancers = copyDancers(prev.dancers);
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      dancers[id].pos = prev.dancers[id].pos.add(
        final.dancers[id].pos.subtract(prev.dancers[id].pos).multiply(t),
      );
      dancers[id].facing = prev.dancers[id].facing.rotateByRadians(ccwRadsBetween(prev.dancers[id].facing, final.dancers[id].facing) * t);
    }
    return { beat, dancers, hands: prev.hands };
  };
}
