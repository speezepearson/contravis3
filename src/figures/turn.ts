import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { normalizeBearing } from '../types';
import { PROTO_DANCER_IDS, copyDancers, resolveFacing } from '../generateUtils';

export function generateTurn(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'turn' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const dancers = copyDancers(prev.dancers);

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const base = resolveFacing(instr.target, prev.dancers[id], id, prev.dancers);
    dancers[id].facing = normalizeBearing(base + instr.offset);
  }

  return [{
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  }];
}
