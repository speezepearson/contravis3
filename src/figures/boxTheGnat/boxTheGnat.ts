import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, DancerId } from '../../types';
import { makeFinalKeyframe, dancerPosition } from '../../types';
import { copyDancers, ellipsePosition, isLark, resolvePairs } from '../../generateUtils';
import { Vector } from 'vecti';

type GnatPair = {
  proto: ProtoDancerId;
  foil: DancerId;
  protoStart: Vector;
  foilStart: Vector;
  semiMinor: number;
};

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>) {
  const pairMap = resolvePairs(instr.relationship, prev.dancers, scope, { pairRoles: 'different' });

  const pairs: GnatPair[] = [];

  for (const [proto, foil] of pairMap) {
    const protoState = dancerPosition(proto, prev.dancers);
    const foilState = dancerPosition(foil, prev.dancers);
    const dist = protoState.pos.subtract(foilState.pos).length();

    pairs.push({
      proto, foil,
      protoStart: protoState.pos,
      foilStart: foilState.pos,
      semiMinor: dist / 4,
    });
  }

  // Hands during the figure: prev hands + right-to-right
  const gnatHands = [...prev.hands];
  for (const { proto, foil } of pairs) {
    gnatHands.push({ a: proto, ha: 'right', b: foil, hb: 'right' });
  }

  return { pairs, gnatHands };
}

export function finalBoxTheGnat(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { pairs } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const p of pairs) {
    dancers[p.proto].pos = p.foilStart;
    dancers[p.proto].facing = p.protoStart.subtract(p.foilStart).normalize();
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
    const theta = Math.PI * t;

    const dancers = copyDancers(prev.dancers);
    for (const p of pairs) {
      dancers[p.proto].pos = ellipsePosition(p.protoStart, p.foilStart, p.semiMinor, theta);
      dancers[p.proto].facing = p.foilStart.subtract(p.protoStart).normalize().rotateByRadians(Math.PI * t * (isLark(p.proto) ? -1 : 1));
    }

    result.push({ beat, dancers, hands: gnatHands });
  }

  return result;
}
