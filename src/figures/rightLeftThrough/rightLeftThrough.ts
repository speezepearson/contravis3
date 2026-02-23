import type { Keyframe, FinalKeyframe, AtomicInstruction } from '../../types';
import { findDancerOnSide, ALL_DANCERS, getRelationship } from '../../generateUtils';
import { finalPullBy, generatePullBy } from '../pullBy/pullBy';
import { finalCourtesyTurn, generateCourtesyTurn } from '../courtesyTurn/courtesyTurn';
import { finalDropHands, generateDropHands } from '../dropHands/dropHands';

function instructionBreakdown(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: 'right_left_through' }>,
): {
  dropHandsInstr: Extract<AtomicInstruction, { type: 'drop_hands' }>;
  pullByInstr: Extract<AtomicInstruction, { type: 'pull_by' }>;
  courtesyTurnInstr: Extract<AtomicInstruction, { type: 'courtesy_turn' }>;
} {
  const halfBeats = instr.beats / 2;

  const inFrontDancer = findDancerOnSide('up_lark_0', 'in_front', prev.dancers);
  if (!inFrontDancer) throw new Error('right_left_through: no in front dancer found');

  const pullByRel = getRelationship('up_lark_0', inFrontDancer.dancerId);
  if (!pullByRel) throw new Error('right_left_through: no pull by relationship found');

  return {
    dropHandsInstr: {id: 'dummy', type: 'drop_hands', beats: 0, target: 'both'} as const,
    pullByInstr: {id: 'dummy', type: 'pull_by', beats: halfBeats, hand: 'right', relationship: pullByRel} as const,
    courtesyTurnInstr: {id: 'dummy', type: 'courtesy_turn', beats: halfBeats} as const,
  };
}

export function finalRightLeftThrough(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: 'right_left_through' }>,
): FinalKeyframe {
  const breakdown = instructionBreakdown(prev, instr);

  let kf = finalPullBy(prev, breakdown.pullByInstr, ALL_DANCERS);
  kf = finalCourtesyTurn(kf, breakdown.courtesyTurnInstr, ALL_DANCERS);
  return kf;
}

export function generateRightLeftThrough(
  prev: Keyframe,
  _final: FinalKeyframe,
  instr: Extract<AtomicInstruction, { type: 'right_left_through' }>,
): Keyframe[] {

  const breakdown = instructionBreakdown(prev, instr);

  const keyframes: Keyframe[] = [prev];

  const dropHandsFinal = finalDropHands(keyframes[keyframes.length-1], breakdown.dropHandsInstr, ALL_DANCERS);
  keyframes.push(...generateDropHands(keyframes[keyframes.length-1], dropHandsFinal, breakdown.dropHandsInstr, ALL_DANCERS), dropHandsFinal);

  const pullByFinal = finalPullBy(keyframes[keyframes.length-1], breakdown.pullByInstr, ALL_DANCERS);
  keyframes.push(...generatePullBy(keyframes[keyframes.length-1], pullByFinal, breakdown.pullByInstr, ALL_DANCERS), pullByFinal);

  const courtesyTurnFinal = finalCourtesyTurn(keyframes[keyframes.length-1], breakdown.courtesyTurnInstr, ALL_DANCERS);
  keyframes.push(...generateCourtesyTurn(keyframes[keyframes.length-1], courtesyTurnFinal, breakdown.courtesyTurnInstr), courtesyTurnFinal);

  return keyframes;
}
