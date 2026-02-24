import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { parseDancerId, makeFinalKeyframe, dancerPosition } from '../../types';
import { Vector } from 'vecti';
import { copyDancers, ellipsePosition, isLark, findDancerOnSide } from '../../generateUtils';


type TwirlPair = {
  proto: ProtoDancerId;
  foil: DancerId;
  protoStart: Vector;
  foilStart: Vector;
  semiMinor: number;
  protoStartFacing: Vector;
  foilStartFacing: Vector;
};

function setup(prev: Keyframe, _instr: Extract<AtomicInstruction, { type: 'california_twirl' }>, scope: Set<ProtoDancerId>) {
  const pairs: TwirlPair[] = [];

  for (const id of scope) {
    // Assert robin is on lark's right
    const foil = findDancerOnSide(id, 'larks_right_robins_left', prev.dancers);
    if (!foil) throw new Error(`California twirl: ${id} has no dancer on his right`);
    if (!scope.has(parseDancerId(foil.dancerId).proto)) throw new Error(`California twirl: ${foil.dancerId} not in scope`);
    if (isLark(foil.dancerId) === isLark(id)) throw new Error(`California twirl: ${id}'s foil ${foil.dancerId} is same role`);

    const protoState = dancerPosition(id, prev.dancers);
    const foilState = dancerPosition(foil.dancerId, prev.dancers);
    const dist = protoState.pos.subtract(foilState.pos).length();

    pairs.push({
      proto: id,
      foil: foil.dancerId,
      protoStart: protoState.pos,
      foilStart: foilState.pos,
      semiMinor: dist / 4,
      protoStartFacing: protoState.facing,
      foilStartFacing: foilState.facing,
    });
  }

  // Inside hands during the figure
  const insideHands: HandConnection[] = [];
  for (const { proto, foil } of pairs) {
    insideHands.push({ a: proto, ha: isLark(proto) ? 'right' : 'left', b: foil, hb: isLark(foil) ? 'right' : 'left' });
  }

  return { pairs, insideHands };
}

export function finalCaliforniaTwirl(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'california_twirl' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs, insideHands } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const p of pairs) {
    // CW ellipse: positive semiMinor
    dancers[p.proto].pos = ellipsePosition(p.protoStart, p.foilStart, p.semiMinor, Math.PI);
    dancers[p.proto].facing = p.protoStartFacing.multiply(-1);
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
      dancers[p.proto].pos = ellipsePosition(p.protoStart, p.foilStart, p.semiMinor, theta);
      dancers[p.proto].facing = p.protoStartFacing.rotateByRadians(Math.PI * t * (isLark(p.proto) ? -1 : 1));
    }

    // Inside hands + drop everything else
    result.push({ beat, dancers, hands: insideHands });
  }
  return result;
}
