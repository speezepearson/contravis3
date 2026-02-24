import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { makeDancerId, parseDancerId, makeFinalKeyframe } from '../../types';
import { copyDancers, ellipsePosition, resolvePairs, isLark } from '../../generateUtils';
import { Vector } from 'vecti';

type GnatPair = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
  larkStart: Vector;
  robinStart: Vector;
  semiMinor: number;
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

    pairs.push({
      lark, robin,
      larkStart: larkState.pos,
      robinStart: robinState.pos,
      semiMinor: dist / 4,
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
    dancers[p.lark].facing = p.larkStart.subtract(p.robinStart).normalize();
    dancers[p.robin].facing = p.robinStart.subtract(p.larkStart).normalize();
  }

  // Hands are dropped at the end (revert to prev.hands)
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  });
}

export function generateBoxTheGnat(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  const { pairs, gnatHands } = setup(prev, instr, scope);

  return (t: number) => {
    const beat = prev.beat + t * instr.beats;
    const theta = Math.PI * t;
    const dancers = copyDancers(prev.dancers);
    for (const p of pairs) {
      dancers[p.lark].pos = ellipsePosition(p.larkStart, p.robinStart, p.semiMinor, theta);
      dancers[p.robin].pos = ellipsePosition(p.robinStart, p.larkStart, p.semiMinor, theta);
      dancers[p.lark].facing = p.robinStart.subtract(p.larkStart).normalize().rotateByRadians(-Math.PI * t);
      dancers[p.robin].facing = p.larkStart.subtract(p.robinStart).normalize().rotateByRadians(Math.PI * t);
    }
    return { beat, dancers, hands: gnatHands };
  };
}
