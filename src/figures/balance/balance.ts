import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { dancerPosition, makeFinalKeyframe } from '../../types';
import { copyDancers, resolveRelationship } from '../../generateUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function finalBalance(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'balance' }>, _scope: Set<ProtoDancerId>): FinalKeyframe {
  // A balance always returns to the starting position.
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: prev.hands,
  });
}

export function generateBalance(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'balance' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const halfBeats = instr.beats / 2;

  const steppedDancers = copyDancers(prev.dancers);
  for (const id of scope) {
    const d = prev.dancers[id];
    const target = resolveRelationship(instr.relationship, id);
    const stepVec = dancerPosition(target, prev.dancers).pos.subtract(d.pos).normalize().multiply(instr.distance);
    steppedDancers[id].pos = d.pos.add(stepVec);
  }

  return [
    { beat: prev.beat + halfBeats, dancers: steppedDancers, hands: prev.hands },
  ];
}
