import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { makeDancerId, parseDancerId, normalizeBearing, makeFinalKeyframe } from '../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs, isLark } from '../generateUtils';

type GnatPair = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
  larkStart: { x: number; y: number };
  robinStart: { x: number; y: number };
  semiMinor: number;
  larkStartFacing: number;
  robinStartFacing: number;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>) {
  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });

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

  // Hands during the figure: prev hands + right-to-right
  const gnatHands = [...prev.hands];
  for (const { lark, robin } of pairs) {
    gnatHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'right' });
  }

  return { pairs, gnatHands };
}

export function finalBoxTheGnat(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const p of pairs) {
    // Positions swap via half-ellipse (theta = PI)
    const larkPos = ellipsePosition(p.larkStart, p.robinStart, p.semiMinor, Math.PI);
    const robinPos = ellipsePosition(p.robinStart, p.larkStart, p.semiMinor, Math.PI);
    dancers[p.lark].x = larkPos.x;
    dancers[p.lark].y = larkPos.y;
    dancers[p.robin].x = robinPos.x;
    dancers[p.robin].y = robinPos.y;

    // Lark turns CW 180°, robin turns CCW 180°
    dancers[p.lark].facing = normalizeBearing(p.larkStartFacing + Math.PI);
    dancers[p.robin].facing = normalizeBearing(p.robinStartFacing - Math.PI);
  }

  // Hands are dropped at the end (revert to prev.hands)
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  });
}

export function generateBoxTheGnat(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { pairs, gnatHands } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
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

      const larkFacing = p.larkStartFacing + Math.PI * tEased;
      const robinFacing = p.robinStartFacing - Math.PI * tEased;
      dancers[p.lark].facing = normalizeBearing(larkFacing);
      dancers[p.robin].facing = normalizeBearing(robinFacing);
    }

    // Gnat hands held during intermediates
    result.push({ beat, dancers, hands: gnatHands });
  }

  return result;
}
