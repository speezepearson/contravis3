import { type Keyframe, type FinalKeyframe, type AtomicInstruction, WEST, EAST } from '../../types';
import { findDancerOnSide, ALL_DANCERS, getRelationship, copyDancers, PROTO_DANCER_IDS } from '../../generateUtils';
import { finalPullBy, generatePullBy } from '../pullBy/pullBy';
import { finalBalance, generateBalance } from '../balance/balance';
import { finalDropHands, generateDropHands } from '../dropHands/dropHands';
import { finalStep, generateStep } from '../step/step';
import { finalTakeHands, generateTakeHands } from '../takeHands/takeHands';

function instructionBreakdown(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: 'square_through' }>,
) {
  const facingAcross = copyDancers(prev.dancers);
  for (const id of PROTO_DANCER_IDS) {
    facingAcross[id].facing = facingAcross[id].pos.x < 0 ? EAST : WEST;
  }

  const inFrontDancer = findDancerOnSide('up_lark_0', 'in_front', facingAcross);
  if (!inFrontDancer) throw new Error('square_through: no in front dancer found');

  const pullByRightRel = getRelationship('up_lark_0', inFrontDancer.dancerId);
  if (!pullByRightRel) throw new Error('square_through: no pull by right relationship found');

  const onLeftDancer = findDancerOnSide('up_lark_0', 'on_right', facingAcross);
  if (!onLeftDancer) throw new Error('square_through: no dancer on right found');

  const pullByLeftRel = getRelationship('up_lark_0', onLeftDancer.dancerId);
  if (!pullByLeftRel) throw new Error('square_through: no pull by left relationship found');

  return [
    {id: 'dummy', type: 'step', beats: 0, direction: {kind: 'direction', value: 'across'}, distance: 0, facing: {kind: 'direction', value: 'across'}, facingOffset: 0} as const,
    {id: 'dummy', type: 'drop_hands', beats: 0, target: 'both'} as const,
    {id: 'dummy', type: 'take_hands', beats: 0, relationship: pullByRightRel, hand: 'right'} as const,
    {id: 'balance', type: 'balance', beats: instr.beats / 2, relationship: pullByRightRel, distance: 0.2} as const,
    {id: 'dummy', type: 'pull_by', beats: instr.beats / 4, hand: 'right', relationship: pullByRightRel} as const,
    {id: 'dummy', type: 'pull_by', beats: instr.beats / 4, hand: 'left', relationship: pullByLeftRel} as const,
  ] as const;
}

export function finalSquareThrough(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: 'square_through' }>,
): FinalKeyframe {
  const [face, drop, take, balance, pullRight, pullLeft] = instructionBreakdown(prev, instr);

  let kf;
  kf = finalStep(prev, face, ALL_DANCERS);
  kf = finalDropHands(kf, drop, ALL_DANCERS);
  kf = finalTakeHands(kf, take, ALL_DANCERS);
  kf = finalBalance(kf, balance, ALL_DANCERS);
  kf = finalPullBy(kf, pullRight, ALL_DANCERS);
  kf = finalPullBy(kf, pullLeft, ALL_DANCERS);
  return kf;
}

export function generateSquareThrough(
  prev: Keyframe,
  _final: FinalKeyframe,
  instr: Extract<AtomicInstruction, { type: 'square_through' }>,
): Keyframe[] {

  const [face, drop, take, balance, pullRight, pullLeft] = instructionBreakdown(prev, instr);

  const keyframes: Keyframe[] = [prev];

  let prevFinal = prev;

  let nextFinal = finalStep(prevFinal, face, ALL_DANCERS);
  keyframes.push(...generateStep(prev, nextFinal, face, ALL_DANCERS), nextFinal);
  prevFinal = nextFinal;

  nextFinal = finalDropHands(prevFinal, drop, ALL_DANCERS);
  keyframes.push(...generateDropHands(prevFinal, nextFinal, drop, ALL_DANCERS), nextFinal);
  prevFinal = nextFinal;

  nextFinal = finalTakeHands(prevFinal, take, ALL_DANCERS);
  keyframes.push(...generateTakeHands(prevFinal, nextFinal, take, ALL_DANCERS), nextFinal);
  prevFinal = nextFinal;

  nextFinal = finalBalance(prevFinal, balance, ALL_DANCERS);
  keyframes.push(...generateBalance(prevFinal, nextFinal, balance, ALL_DANCERS), nextFinal);
  prevFinal = nextFinal;

  nextFinal = finalPullBy(prevFinal, pullRight, ALL_DANCERS);
  keyframes.push(...generatePullBy(prevFinal, nextFinal, pullRight, ALL_DANCERS), nextFinal);
  prevFinal = nextFinal;

  nextFinal = finalPullBy(prevFinal, pullLeft, ALL_DANCERS);
  keyframes.push(...generatePullBy(prevFinal, nextFinal, pullLeft, ALL_DANCERS), nextFinal);

  return keyframes;
}
