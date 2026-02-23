import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { Vector, makeFinalKeyframe, dancerPosition } from '../../types';
import { copyDancers, isLark, findDancerOnSide, PROTO_DANCER_IDS } from '../../generateUtils';

export function finalCourtesyTurn(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: 'courtesy_turn' }>,
  scope: Set<ProtoDancerId>,
): FinalKeyframe {
  const dancers = copyDancers(prev.dancers);
  const hands: HandConnection[] = [];

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const foil = findDancerOnSide(id, 'larks_right_robins_left', prev.dancers);
    if (!foil) throw new Error(`courtesy_turn: ${id} has no foil`);

    const ourPos = prev.dancers[id].pos;
    const foilPos = dancerPosition(foil.dancerId, prev.dancers).pos;
    if ((ourPos.x < 0) !== (foilPos.x < 0)) throw new Error(`courtesy_turn: ${id} and foil ${foil.dancerId} are on opposite sides of the set`);

    dancers[id].pos = foilPos;
    dancers[id].facing = dancers[id].facing.multiply(-1);

    hands.push({ a: id, ha: 'left', b: foil.dancerId, hb: 'left' });
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands,
  });
}

/**
 * Intermediate keyframes for courtesy turn.
 */
export function generateCourtesyTurn(
  prev: Keyframe,
  _final: FinalKeyframe,
  instr: Extract<AtomicInstruction, { type: 'courtesy_turn' }>,
): Keyframe[] {
  const totalBeats = instr.beats;

  const pairs: {
    proto: ProtoDancerId;
    foil: DancerId;
    center: Vector;
    radius: number;
  }[] = [];

  for (const id of PROTO_DANCER_IDS) {
    const foil = findDancerOnSide(id, 'larks_right_robins_left', prev.dancers);
    if (!foil) throw new Error(`courtesy_turn: ${id} has no dancer on their side for courtesy turn`);
    if (isLark(foil.dancerId) === isLark(id)) throw new Error(`courtesy_turn: ${id}'s foil ${foil.dancerId} has the same role`);

    const protoPos = dancerPosition(id, prev.dancers).pos;
    const foilPos = dancerPosition(foil.dancerId, prev.dancers).pos;
    const center = protoPos.add(foilPos).multiply(0.5);
    const delta = protoPos.subtract(center);

    pairs.push({
      proto: id,
      foil: foil.dancerId,
      center,
      radius: delta.length(),
    });
  }

  // Generate intermediate keyframes (not including the final)
  const nFrames = Math.max(1, Math.round(totalBeats / 0.25));
  const result: Keyframe[] = [];

  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * totalBeats;
    const elapsed = t * totalBeats;
    const dancers = copyDancers(prev.dancers);

    const tPhase = elapsed / totalBeats;
    const hands: HandConnection[] = [];

    for (const { proto, foil, center, radius } of pairs) {
      const facing = prev.dancers[proto].facing.rotateByRadians(tPhase * Math.PI);

      dancers[proto].facing = facing;
      dancers[proto].pos = center.add(facing
          .multiply(radius)
          .rotateByRadians(Math.PI/2 * (isLark(proto) ? 1 : -1)));

          hands.push({ a: proto, ha: 'left', b: foil, hb: 'left' });
      hands.push({ a: proto, ha: 'right', b: foil, hb: 'right' });
    }

    result.push({ beat, dancers, hands });
  }

  return result;
}
