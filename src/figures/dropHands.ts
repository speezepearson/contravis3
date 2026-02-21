import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { makeDancerId, parseDancerId } from '../types';
import { PROTO_DANCER_IDS, copyDancers, resolveRelationship } from '../generateUtils';

export function generateDropHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'drop_hands' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const target = instr.target;
  let newHands;

  if (target === 'both') {
    newHands = prev.hands.filter(h => !scope.has(parseDancerId(h.a).proto) && !scope.has(parseDancerId(h.b).proto));
  } else if (target === 'left' || target === 'right') {
    newHands = prev.hands.filter(h => {
      if (scope.has(parseDancerId(h.a).proto) && h.ha === target) return false;
      if (scope.has(parseDancerId(h.b).proto) && h.hb === target) return false;
      return true;
    });
  } else {
    const pairSet = new Set<string>();
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const resolved = resolveRelationship(target, id, prev.dancers);
      const aId = makeDancerId(id, 0);
      pairSet.add(`${aId}:${resolved}`);
      pairSet.add(`${resolved}:${aId}`);
    }
    newHands = prev.hands.filter(h => !pairSet.has(`${h.a}:${h.b}`));
  }

  return [{
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: newHands,
  }];
}
