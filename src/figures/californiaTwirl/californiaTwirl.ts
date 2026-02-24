import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection } from '../../types';
import { parseDancerId, makeDancerId, makeFinalKeyframe } from '../../types';
import { Vector } from 'vecti';
import { copyDancers, ellipsePosition, isLark, findDancerOnSide, PROTO_DANCER_IDS } from '../../generateUtils';


type TwirlPair = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
  larkStart: Vector;
  robinStart: Vector;
  semiMinor: number;
  larkStartFacing: Vector;
  robinStartFacing: Vector;
};

function setup(prev: Keyframe, _instr: Extract<AtomicInstruction, { type: 'california_twirl' }>, scope: Set<ProtoDancerId>) {
  const pairs: TwirlPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id) || processed.has(id) || !isLark(id)) continue;

    // Assert robin is on lark's right
    const neighbor = findDancerOnSide(id, 'on_right', prev.dancers);
    if (!neighbor) throw new Error(`California twirl: ${id} has no dancer on his right`);
    const { proto: robinProto } = parseDancerId(neighbor.dancerId);
    if (!scope.has(robinProto)) throw new Error(`California twirl: ${robinProto} not in scope`);
    if (isLark(robinProto)) throw new Error(`California twirl: ${id}'s right neighbor ${robinProto} is a lark, expected robin`);

    processed.add(id);
    processed.add(robinProto);

    const larkState = prev.dancers[id];
    const robinState = prev.dancers[robinProto];
    const dist = larkState.pos.subtract(robinState.pos).length();

    pairs.push({
      lark: id,
      robin: robinProto,
      larkStart: larkState.pos,
      robinStart: robinState.pos,
      semiMinor: dist / 4,
      larkStartFacing: larkState.facing,
      robinStartFacing: robinState.facing,
    });
  }

  // Inside hands during the figure
  const insideHands: HandConnection[] = [];
  for (const { lark, robin } of pairs) {
    insideHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'left' });
  }

  return { pairs, insideHands };
}

export function finalCaliforniaTwirl(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'california_twirl' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs, insideHands } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const p of pairs) {
    // CW ellipse: positive semiMinor
    dancers[p.lark].pos = ellipsePosition(p.larkStart, p.robinStart, p.semiMinor, Math.PI);
    dancers[p.robin].pos = ellipsePosition(p.robinStart, p.larkStart, p.semiMinor, Math.PI);

    // Lark turns CW 180°, robin turns CCW 180°
    dancers[p.lark].facing = p.larkStartFacing.rotateByRadians(Math.PI);
    dancers[p.robin].facing = p.robinStartFacing.rotateByRadians(-Math.PI);
  }

  // End holding inside hands only (no other hands)
  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: insideHands,
  });
}

export function generateCaliforniaTwirl(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'california_twirl' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { pairs, insideHands } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const theta = Math.PI * t;

    const dancers = copyDancers(prev.dancers);
    for (const p of pairs) {
      dancers[p.lark].pos = ellipsePosition(p.larkStart, p.robinStart, p.semiMinor, theta);
      dancers[p.robin].pos = ellipsePosition(p.robinStart, p.larkStart, p.semiMinor, theta);

      dancers[p.lark].facing = p.larkStartFacing.rotateByRadians(-Math.PI * t);
      dancers[p.robin].facing = p.robinStartFacing.rotateByRadians(Math.PI * t);
    }

    // Inside hands + drop everything else
    result.push({ beat, dancers, hands: insideHands });
  }
  return result;
}
