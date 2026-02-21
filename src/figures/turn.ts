import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { makeFinalKeyframe } from '../types';
import { PROTO_DANCER_IDS, copyDancers, resolveFacing } from '../generateUtils';

export function finalTurn(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'turn' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const dancers = copyDancers(prev.dancers);

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const base = resolveFacing(instr.target, prev.dancers[id], id, prev.dancers);
    // offset is CW radians; vecti rotateByRadians is CCW, so negate
    dancers[id].facing = base.rotateByRadians(-instr.offset);
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateTurn(_prev: Keyframe, _final: FinalKeyframe, _instr: Extract<AtomicInstruction, { type: 'turn' }>, _scope: Set<ProtoDancerId>): Keyframe[] {
  return [];
}
