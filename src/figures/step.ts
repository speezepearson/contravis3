import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { PROTO_DANCER_IDS, copyDancers, easeInOut, resolveHeading } from '../generateUtils';

export function generateStep(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'step' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const displacements: Partial<Record<ProtoDancerId, { dx: number; dy: number }>> = {};
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    const heading = resolveHeading(instr.direction, d, id, prev.dancers);
    displacements[id] = {
      dx: Math.sin(heading) * instr.distance,
      dy: Math.cos(heading) * instr.distance,
    };
  }

  const keyframes: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(prev.dancers);
    for (const id of PROTO_DANCER_IDS) {
      const disp = displacements[id];
      if (!disp) continue;
      dancers[id].x = prev.dancers[id].x + disp.dx * tEased;
      dancers[id].y = prev.dancers[id].y + disp.dy * tEased;
    }
    keyframes.push({ beat, dancers, hands: prev.hands });
  }
  return keyframes;
}
