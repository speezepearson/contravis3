import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { type Vector, dancerPosition, makeFinalKeyframe } from '../../types';
import { copyDancers, ellipsePosition, resolvePairs } from '../../generateUtils';

type SwapDatum = {
  protoId: ProtoDancerId;
  startPos: Vector;
  targetPos: Vector;
  originalFacing: Vector;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pass_by' }>, scope: Set<ProtoDancerId>) {
  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});
  const lateralSign = instr.hand === 'right' ? 1 : -1;

  const swapData: SwapDatum[] = [];
  for (const [id, target] of pairs) {
    const da = prev.dancers[id];
    const targetState = dancerPosition(target, prev.dancers);
    swapData.push({
      protoId: id,
      startPos: da.pos,
      targetPos: targetState.pos,
      originalFacing: da.facing,
    });
  }

  return { swapData, lateralSign };
}

export function finalPassBy(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pass_by' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { swapData, lateralSign } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const sd of swapData) {
    dancers[sd.protoId].pos = ellipsePosition(sd.startPos, sd.targetPos, lateralSign * 0.25, Math.PI);
    dancers[sd.protoId].facing = sd.originalFacing;
  }

  return makeFinalKeyframe({ beat: prev.beat + instr.beats, dancers, hands: prev.hands });
}

export function generatePassBy(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'pass_by' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  const { swapData, lateralSign } = setup(prev, instr, scope);

  return (t: number) => {
    const beat = prev.beat + t * instr.beats;
    const dancers = copyDancers(prev.dancers);
    for (const sd of swapData) {
      dancers[sd.protoId].pos = ellipsePosition(sd.startPos, sd.targetPos, lateralSign * 0.25, Math.PI * t);
      dancers[sd.protoId].facing = sd.originalFacing;
    }
    return { beat, dancers, hands: prev.hands };
  };
}
