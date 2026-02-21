import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { makeDancerId, parseDancerId, headingVector, makeFinalKeyframe } from '../../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs, isLark } from '../../generateUtils';
import { Vector } from 'vecti';

type GnatPair = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
  larkStart: Vector;
  robinStart: Vector;
  semiMinor: number;
  larkStartFacingRad: number;
  robinStartFacingRad: number;
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
    const dist = larkState.pos.subtract(robinState.pos).length();

    const delta = robinState.pos.subtract(larkState.pos);
    const larkStartFacingRad = Math.atan2(delta.x, delta.y);
    const robinDelta = larkState.pos.subtract(robinState.pos);
    const robinStartFacingRad = Math.atan2(robinDelta.x, robinDelta.y);

    pairs.push({
      lark, robin,
      larkStart: larkState.pos,
      robinStart: robinState.pos,
      semiMinor: dist / 4,
      larkStartFacingRad, robinStartFacingRad,
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
    dancers[p.lark].pos = ellipsePosition(p.larkStart, p.robinStart, p.semiMinor, Math.PI);
    dancers[p.robin].pos = ellipsePosition(p.robinStart, p.larkStart, p.semiMinor, Math.PI);

    // Lark turns CW 180°, robin turns CCW 180°
    dancers[p.lark].facing = headingVector(p.larkStartFacingRad + Math.PI);
    dancers[p.robin].facing = headingVector(p.robinStartFacingRad - Math.PI);
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
      dancers[p.lark].pos = ellipsePosition(p.larkStart, p.robinStart, p.semiMinor, theta);
      dancers[p.robin].pos = ellipsePosition(p.robinStart, p.larkStart, p.semiMinor, theta);

      const larkFacing = p.larkStartFacingRad + Math.PI * tEased;
      const robinFacing = p.robinStartFacingRad - Math.PI * tEased;
      dancers[p.lark].facing = headingVector(larkFacing);
      dancers[p.robin].facing = headingVector(robinFacing);
    }

    // Gnat hands held during intermediates
    result.push({ beat, dancers, hands: gnatHands });
  }

  return result;
}
