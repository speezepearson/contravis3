import type { Keyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../types';
import { makeDancerId, dancerPosition } from '../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs } from '../generateUtils';

export function generatePullBy(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});

  // Build swap pairs with ellipse parameters and hand connections
  const swapData: {
    protoId: ProtoDancerId;
    startPos: { x: number; y: number };
    targetPos: { x: number; y: number };
    originalFacing: number;
  }[] = [];
  const pullHands: HandConnection[] = [];
  const seen = new Set<string>();
  const lateralSign = instr.hand === 'right' ? 1 : -1;
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

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
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
