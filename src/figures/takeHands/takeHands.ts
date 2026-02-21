import type { Keyframe, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../../types';
import { makeDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, copyDancers, resolveRelationship, resolveInsideHand } from '../../generateUtils';

export function finalTakeHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'take_hands' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const newHands: HandConnection[] = [...prev.hands];
  const seen = new Set<string>();
  if (instr.hand === 'inside') {
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const target = resolveRelationship(instr.relationship, id, prev.dancers);
      const aId = makeDancerId(id, 0);
      const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
      if (!seen.has(key)) {
        seen.add(key);
        const aState = prev.dancers[id];
        const bState = dancerPosition(target, prev.dancers);
        const ha = resolveInsideHand(aState, bState);
        const hb = resolveInsideHand(bState, aState);
        newHands.push({ a: aId, ha, b: target, hb });
      }
    }
  } else {
    const hands: ('left' | 'right')[] = instr.hand === 'both' ? ['left', 'right'] : [instr.hand];
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const target = resolveRelationship(instr.relationship, id, prev.dancers);
      const aId = makeDancerId(id, 0);
      const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
      if (!seen.has(key)) {
        seen.add(key);
        for (const h of hands) {
          newHands.push({ a: aId, ha: h, b: target, hb: h });
        }
      }
    }
  }
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: newHands,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateTakeHands(_prev: Keyframe, _final: FinalKeyframe, _instr: Extract<AtomicInstruction, { type: 'take_hands' }>, _scope: Set<ProtoDancerId>): Keyframe[] {
  return [];
}
