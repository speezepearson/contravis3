import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { makeFinalKeyframe } from '../types';
import { PROTO_DANCER_IDS, copyDancers, easeInOut, resolveHeading } from '../generateUtils';

export function finalStep(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'step' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const dancers = copyDancers(prev.dancers);
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    const heading = resolveHeading(instr.direction, d, id, prev.dancers);
    dancers[id].x = d.x + Math.sin(heading) * instr.distance;
    dancers[id].y = d.y + Math.cos(heading) * instr.distance;
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
      dancers[id].x = prev.dancers[id].x + (final.dancers[id].x - prev.dancers[id].x) * tEased;
      dancers[id].y = prev.dancers[id].y + (final.dancers[id].y - prev.dancers[id].y) * tEased;
    }
    keyframes.push({ beat, dancers, hands: prev.hands });
  }
  return keyframes;
}
