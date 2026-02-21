import type { Keyframe, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../types';
import { makeDancerId, dancerPosition, makeFinalKeyframe } from '../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs } from '../generateUtils';

type SwapDatum = {
  protoId: ProtoDancerId;
  startPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  originalFacing: number;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>) {
  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});
  const lateralSign = instr.hand === 'right' ? 1 : -1;

  const swapData: SwapDatum[] = [];
  const pullHands: HandConnection[] = [];
  const seen = new Set<string>();
  for (const [id, target] of pairs) {
    const da = prev.dancers[id];
    const targetPos = dancerPosition(target, prev.dancers);
    swapData.push({
      protoId: id,
      startPos: { x: da.x, y: da.y },
      targetPos: { x: targetPos.x, y: targetPos.y },
      originalFacing: da.facing,
    });
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!seen.has(key)) {
      seen.add(key);
      pullHands.push({ a: aId, ha: instr.hand, b: target, hb: instr.hand });
    }
  }
  const hands = [...prev.hands, ...pullHands];

  return { swapData, hands, lateralSign };
}

export function finalPullBy(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { swapData, hands, lateralSign } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const sd of swapData) {
    const pos = ellipsePosition(sd.startPos, sd.targetPos, lateralSign * 0.25, Math.PI);
    dancers[sd.protoId].x = pos.x;
    dancers[sd.protoId].y = pos.y;
    dancers[sd.protoId].facing = sd.originalFacing;
  }

  return makeFinalKeyframe({ beat: prev.beat + instr.beats, dancers, hands });
}

export function generatePullBy(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { swapData, hands, lateralSign } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const dancers = copyDancers(prev.dancers);
    for (const sd of swapData) {
      const pos = ellipsePosition(sd.startPos, sd.targetPos, lateralSign * 0.25, Math.PI * easeInOut(t));
      dancers[sd.protoId].x = pos.x;
      dancers[sd.protoId].y = pos.y;
      dancers[sd.protoId].facing = sd.originalFacing;
    }
    result.push({ beat, dancers, hands });
  }
  return result;
}
