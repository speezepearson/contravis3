import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { finalCaliforniaTwirl, generateCaliforniaTwirl } from '../californiaTwirl/californiaTwirl';

// Turn as a couple is just an alias for California twirl.
// We cast the instruction type so the underlying implementation can handle it.

type TurnAsACoupleInstr = Extract<AtomicInstruction, { type: 'turn_as_a_couple' }>;
type CaliforniaTwirlInstr = Extract<AtomicInstruction, { type: 'california_twirl' }>;

function asTwirl(instr: TurnAsACoupleInstr): CaliforniaTwirlInstr {
  return { ...instr, type: 'california_twirl' } as CaliforniaTwirlInstr;
}

export function finalTurnAsACouple(prev: Keyframe, instr: TurnAsACoupleInstr, scope: Set<ProtoDancerId>): FinalKeyframe {
  return finalCaliforniaTwirl(prev, asTwirl(instr), scope);
}

export function generateTurnAsACouple(prev: Keyframe, final: FinalKeyframe, instr: TurnAsACoupleInstr, scope: Set<ProtoDancerId>): KeyframeFn {
  return generateCaliforniaTwirl(prev, final, asTwirl(instr), scope);
}
