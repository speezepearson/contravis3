import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { makeFinalKeyframe } from '../types';
import { copyDancers } from '../generateUtils';
import { finalStep, generateStep } from './step';

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

  const forward = { kind: 'direction' as const, value: 'forward' as const };
  const stepOutInstr = { id: instr.id, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: instr.distance, facing: forward, facingOffset: 0 };
  const outFinal = finalStep(prev, stepOutInstr, scope);
  const outIntermediates = generateStep(prev, outFinal, stepOutInstr, scope);

  const stepBackInstr = { id: instr.id, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: -instr.distance, facing: forward, facingOffset: 0 };
  const backFinal = finalStep(outFinal, stepBackInstr, scope);
  const backIntermediates = generateStep(outFinal, backFinal, stepBackInstr, scope);

  return [...outIntermediates, outFinal, ...backIntermediates];
}
