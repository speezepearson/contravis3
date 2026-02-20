import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { makeDancerId, parseDancerId, normalizeBearing } from '../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs, isLark } from '../generateUtils';

export function generateBoxTheGnat(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });

  // Collect pairs
  type GnatPair = {
    lark: ProtoDancerId;
    robin: ProtoDancerId;
    larkStart: { x: number; y: number };
    robinStart: { x: number; y: number };
    semiMinor: number;
    larkStartFacing: number;
    robinStartFacing: number;
  };

  const pairs: GnatPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const [id] of pairMap) {
    if (processed.has(id)) continue;

    const targetId = pairMap.get(id)!;
    const { proto: targetProto } = parseDancerId(targetId);

    const lark = isLark(id) ? id : targetProto;
    const robin = isLark(id) ? targetProto : id;
    processed.add(lark);
    processed.add(robin);

    const larkState = prev.dancers[lark];
    const robinState = prev.dancers[robin];
    const dist = Math.hypot(larkState.x - robinState.x, larkState.y - robinState.y);

    const larkStartFacing = Math.atan2(robinState.x - larkState.x, robinState.y - larkState.y);
    const robinStartFacing = Math.atan2(larkState.x - robinState.x, larkState.y - robinState.y);

    pairs.push({
      lark, robin,
      larkStart: { x: larkState.x, y: larkState.y },
      robinStart: { x: robinState.x, y: robinState.y },
      semiMinor: dist / 4,
      larkStartFacing, robinStartFacing,
    });
  }

  // Build hand connections: right hand to right hand
  let gnatHands = [...prev.hands];
  for (const { lark, robin } of pairs) {
    gnatHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'right' });
  }

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const theta = Math.PI * tEased;

    const dancers = copyDancers(prev.dancers);
    for (const p of pairs) {
      const larkPos = ellipsePosition(p.larkStart, p.robinStart, p.semiMinor, theta);
      const robinPos = ellipsePosition(p.robinStart, p.larkStart, p.semiMinor, theta);
      dancers[p.lark].x = larkPos.x;
      dancers[p.lark].y = larkPos.y;
      dancers[p.robin].x = robinPos.x;
      dancers[p.robin].y = robinPos.y;

      // Lark turns CW 180°, robin turns CCW 180°
      const larkFacing = p.larkStartFacing + Math.PI * tEased;
      const robinFacing = p.robinStartFacing - Math.PI * tEased;
      dancers[p.lark].facing = normalizeBearing(larkFacing);
      dancers[p.robin].facing = normalizeBearing(robinFacing);
    }

    // Drop hands on the final frame
    const hands = i === nFrames ? prev.hands : gnatHands;
    result.push({ beat, dancers, hands });
  }

  return result;
}
