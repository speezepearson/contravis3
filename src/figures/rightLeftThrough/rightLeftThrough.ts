import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection, DancerId } from '../../types';
import { Vector, parseDancerId, makeDancerId, makeFinalKeyframe, EAST, WEST, dancerPosition } from '../../types';
import { copyDancers, easeInOut, ellipsePosition, isLark, findDancerOnSide, PROTO_DANCER_IDS } from '../../generateUtils';

export function finalRightLeftThrough(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: 'right_left_through' }>,
  scope: Set<ProtoDancerId>,
): FinalKeyframe {
  const initDancersFacingAcross = copyDancers(prev.dancers);
  for (const id of PROTO_DANCER_IDS) {
    initDancersFacingAcross[id].facing = initDancersFacingAcross[id].pos.x < 0 ? EAST : WEST;
  }
  const dancers = copyDancers(prev.dancers);
  const hands: HandConnection[] = [];

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const foil = findDancerOnSide(id, 'larks_right_robins_left', initDancersFacingAcross);
    if (!foil) throw new Error(`right_left_through: ${id} has no foil`);

    const ourPos = prev.dancers[id].pos;
    const foilPos = dancerPosition(foil.dancerId, prev.dancers).pos;
    if ((ourPos.x < 0) !== (foilPos.x < 0)) throw new Error(`right_left_through: ${id} and foil ${foil.dancerId} are on opposite sides of the set`);
    const targetX = ourPos.x < 0 ? 1 : -1;
    const finalFacing = targetX < 0 ? WEST : EAST;

    dancers[id].pos = new Vector(targetX, foilPos.y);
    dancers[id].facing = finalFacing.multiply(-1);

    hands.push({ a: id, ha: 'left', b: foil.dancerId, hb: 'left' });
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands,
  });
}

/**
 * Intermediate keyframes for right left through.
 *
 * Phase 1 (first half): every dancer immediately faces across and walks in a
 * clockwise ellipse to {x: otherSide, y: theirCurrentY}.
 *
 * Phase 2 (second half): courtesy turn — the lark and the robin on his right
 * take both hands and revolve 180° CCW around their common center, then drop
 * right hands. Facing stays constant (across the set) throughout the turn.
 */
export function generateRightLeftThrough(
  prev: Keyframe,
  _final: FinalKeyframe,
  instr: Extract<AtomicInstruction, { type: 'right_left_through' }>,
): Keyframe[] {
  const totalBeats = instr.beats;
  const halfBeats = totalBeats / 2;

  // Phase 1 setup: each dancer crosses to the other side of the set
  const crossData: { id: ProtoDancerId; start: Vector; target: Vector; phase1Facing: Vector }[] = [];
  for (const id of PROTO_DANCER_IDS) {
    const d = prev.dancers[id];
    const targetX = d.pos.x < 0 ? 1 : -1;
    crossData.push({
      id,
      start: d.pos,
      target: new Vector(targetX, d.pos.y),
      phase1Facing: d.pos.x < 0 ? EAST : WEST,
    });
  }

  // Phase 2 setup: compute the midpoint state (end of crossing), then find
  // lark-robin pairs for the courtesy turn.
  const midDancers = copyDancers(prev.dancers);
  for (const cd of crossData) {
    midDancers[cd.id].pos = cd.target;
    midDancers[cd.id].facing = cd.phase1Facing;
  }

  const pairs: {
    proto: ProtoDancerId;
    foil: DancerId;
    center: Vector;
    radius: number;
    initAcrossFacing: Vector;
  }[] = [];

  for (const id of PROTO_DANCER_IDS) {
    const foil = findDancerOnSide(id, 'larks_right_robins_left', midDancers);
    if (!foil) throw new Error(`right_left_through: ${id} has no dancer on their side for courtesy turn`);
    if (isLark(foil.dancerId) === isLark(id)) throw new Error(`right_left_through: ${id}'s foil ${foil.dancerId} has the same role`);

    const protoPos = dancerPosition(id, midDancers).pos;
    const foilPos = dancerPosition(foil.dancerId, midDancers).pos;
    const center = protoPos.add(foilPos).multiply(0.5);
    const delta = protoPos.subtract(center);

    pairs.push({
      proto: id,
      foil: foil.dancerId,
      center,
      radius: delta.length(),
      initAcrossFacing: prev.dancers[id].pos.x < 0 ? EAST : WEST,
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

    if (elapsed <= halfBeats) {
      // Phase 1: cross via CW ellipse, immediately face across
      const tPhase = elapsed / halfBeats;
      const theta = Math.PI * easeInOut(tPhase);
      for (const cd of crossData) {
        dancers[cd.id].pos = ellipsePosition(cd.start, cd.target, 0.25, theta);
        dancers[cd.id].facing = cd.phase1Facing;
      }
      result.push({ beat, dancers, hands: [] });
    } else {
      // Phase 2: courtesy turn — 180° CCW revolve, facing stays constant
      const tPhase = (elapsed - halfBeats) / halfBeats;
      const hands: HandConnection[] = [];

      for (const { proto, foil, center, radius, initAcrossFacing } of pairs) {
        console.log({proto, foil})
        const facingAngle = initAcrossFacing.rotateByRadians(tPhase * Math.PI);

        dancers[proto].facing = facingAngle;
        dancers[proto].pos = center.add(facingAngle
          .multiply(radius)
          .rotateByRadians(Math.PI/2 * (isLark(proto) ? 1 : -1)));

        hands.push({ a: proto, ha: 'left', b: foil, hb: 'left' });
        hands.push({ a: proto, ha: 'right', b: foil, hb: 'right' });
      }

      result.push({ beat, dancers, hands });
    }
  }

  return result;
}
