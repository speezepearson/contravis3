import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { generateStep } from './step';

export function generateBalance(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'balance' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const halfBeats = instr.beats / 2;
  const stepOut = { id: instr.id, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: instr.distance };
  const outFrames = generateStep(prev, stepOut, scope);
  const lastOut = outFrames.length > 0 ? outFrames[outFrames.length - 1] : prev;
  const stepBack = { id: instr.id, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: -instr.distance };
  const backFrames = generateStep(lastOut, stepBack, scope);
  return [...outFrames, ...backFrames];
}
