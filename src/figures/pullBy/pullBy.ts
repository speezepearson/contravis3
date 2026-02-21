import type { Keyframe, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../../types';
import { type Vector, makeDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs } from '../../generateUtils';

type SwapDatum = {
  protoId: ProtoDancerId;
  startPos: Vector;
  targetPos: Vector;
  originalFacing: Vector;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>) {
  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});
  const lateralSign = instr.hand === 'right' ? 1 : -1;

  const swapData: SwapDatum[] = [];
  const pullHands: HandConnection[] = [];
  const seen = new Set<string>();
  for (const [id, target] of pairs) {
    const da = prev.dancers[id];
    const targetState = dancerPosition(target, prev.dancers);
    swapData.push({
      protoId: id,
      startPos: da.pos,
      targetPos: targetState.pos,
      originalFacing: da.facing,
    });
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!seen.has(key)) {
      seen.add(key);
      pullHands.push({ a: aId, ha: instr.hand, b: target, hb: instr.hand });
    }
  }
  const handsGripping = [...prev.hands, ...pullHands];
  const handsReleased = prev.hands;

  return { swapData, handsGripping, handsReleased, lateralSign };
}

export function finalPullBy(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { swapData, handsReleased, lateralSign } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const sd of swapData) {
    dancers[sd.protoId].pos = ellipsePosition(sd.startPos, sd.targetPos, lateralSign * 0.25, Math.PI);
    dancers[sd.protoId].facing = sd.originalFacing;
  }

  return makeFinalKeyframe({ beat: prev.beat + instr.beats, dancers, hands: handsReleased });
}

export function generatePullBy(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { swapData, handsGripping, handsReleased, lateralSign } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const dancers = copyDancers(prev.dancers);
    for (const sd of swapData) {
      dancers[sd.protoId].pos = ellipsePosition(sd.startPos, sd.targetPos, lateralSign * 0.25, Math.PI * easeInOut(t));
      dancers[sd.protoId].facing = sd.originalFacing;
    }
    const hands = t <= 0.5 ? handsGripping : handsReleased;
    result.push({ beat, dancers, hands });
  }
  return result;
}
