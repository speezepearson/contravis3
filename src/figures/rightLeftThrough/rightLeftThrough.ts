import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId, HandConnection } from '../../types';
import { Vector, parseDancerId, makeDancerId, headingVector, makeFinalKeyframe, EAST, WEST } from '../../types';
import { copyDancers, easeInOut, ellipsePosition, isLark, findNeighborOnSide, PROTO_DANCER_IDS } from '../../generateUtils';

type RLTPair = {
  lark: ProtoDancerId;
  robin: ProtoDancerId;
};

/**
 * Phase 1: cross the set. Every dancer walks from their current position
 * to {x: otherSide, y: theirCurrentY} via a CW ellipse.
 */
function computePhase1(prev: Keyframe, scope: Set<ProtoDancerId>) {
  const crossData: { id: ProtoDancerId; startPos: Vector; targetPos: Vector }[] = [];
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    const targetX = d.pos.x < 0 ? 1 : -1;
    crossData.push({
      id,
      startPos: d.pos,
      targetPos: new Vector(targetX, d.pos.y),
    });
  }
  return crossData;
}

/**
 * Phase 2: courtesy turn. Find lark-robin pairs (robin on lark's right),
 * revolve 180 CCW around their common center.
 */
function computePhase2(midDancers: Record<ProtoDancerId, { pos: Vector; facing: Vector }>, scope: Set<ProtoDancerId>) {
  const pairs: RLTPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id) || processed.has(id) || !isLark(id)) continue;

    const neighbor = findNeighborOnSide(id, 'right', midDancers as Record<ProtoDancerId, { pos: Vector; facing: Vector }>);
    if (!neighbor) throw new Error(`Right left through: ${id} has no dancer on his right for courtesy turn`);
    const { proto: robinProto } = parseDancerId(neighbor.dancerId);
    if (!scope.has(robinProto)) throw new Error(`Right left through: ${robinProto} not in scope`);
    if (isLark(robinProto)) throw new Error(`Right left through: ${id}'s right neighbor ${robinProto} is a lark, expected robin`);

    processed.add(id);
    processed.add(robinProto);
    pairs.push({ lark: id, robin: robinProto });
  }

  return pairs;
}

export function finalRightLeftThrough(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'right_left_through' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const crossData = computePhase1(prev, scope);

  // Compute midpoint state (end of phase 1)
  const midDancers = copyDancers(prev.dancers);
  for (const cd of crossData) {
    midDancers[cd.id].pos = ellipsePosition(cd.startPos, cd.targetPos, 0.25, Math.PI);
    midDancers[cd.id].facing = cd.targetPos.x < 0 ? EAST : WEST;
  }

  const pairs = computePhase2(midDancers, scope);

  // Final state: after courtesy turn (180 CCW revolve)
  const dancers = copyDancers(midDancers);
  const finalHands: HandConnection[] = [];

  for (const { lark, robin } of pairs) {
    const larkPos = midDancers[lark].pos;
    const robinPos = midDancers[robin].pos;

    // 180 CCW revolve: each dancer ends at the other's starting position
    dancers[lark].pos = robinPos;
    dancers[robin].pos = larkPos;

    // Both face across the set from their new position
    dancers[lark].facing = dancers[lark].pos.x < 0 ? EAST : WEST;
    dancers[robin].facing = dancers[robin].pos.x < 0 ? EAST : WEST;

    // End holding left hands only
    finalHands.push({ a: makeDancerId(lark, 0), ha: 'left', b: makeDancerId(robin, 0), hb: 'left' });
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: finalHands,
  });
}

export function generateRightLeftThrough(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'right_left_through' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const totalBeats = instr.beats;
  const phase1Beats = totalBeats / 2;
  const phase2Beats = totalBeats / 2;

  const crossData = computePhase1(prev, scope);

  // Compute midpoint state
  const midDancers = copyDancers(prev.dancers);
  for (const cd of crossData) {
    midDancers[cd.id].pos = ellipsePosition(cd.startPos, cd.targetPos, 0.25, Math.PI);
    midDancers[cd.id].facing = cd.targetPos.x < 0 ? EAST : WEST;
  }

  const pairs = computePhase2(midDancers, scope);

  const nFrames = Math.max(1, Math.round(totalBeats / 0.25));
  const result: Keyframe[] = [];

  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * totalBeats;
    const elapsed = t * totalBeats;

    const dancers = copyDancers(prev.dancers);

    if (elapsed <= phase1Beats) {
      // Phase 1: cross the set via CW ellipse
      const tPhase = elapsed / phase1Beats;
      const theta = Math.PI * easeInOut(tPhase);
      for (const cd of crossData) {
        dancers[cd.id].pos = ellipsePosition(cd.startPos, cd.targetPos, 0.25, theta);
        // Immediately face across
        dancers[cd.id].facing = cd.startPos.x < 0 ? EAST : WEST;
      }
      result.push({ beat, dancers, hands: prev.hands });
    } else {
      // Phase 2: courtesy turn (180 CCW revolve)
      const tPhase = (elapsed - phase1Beats) / phase2Beats;
      const angle = Math.PI * easeInOut(tPhase); // 0 -> PI (CCW)

      // Hands during courtesy turn: left + right
      const courtesyHands: HandConnection[] = [];

      for (const { lark, robin } of pairs) {
        const larkMid = midDancers[lark].pos;
        const robinMid = midDancers[robin].pos;
        const center = larkMid.add(robinMid).multiply(0.5);
        const radius = larkMid.subtract(center).length();

        // Initial angle of lark from center
        const larkDelta = larkMid.subtract(center);
        const larkAngle0 = Math.atan2(larkDelta.x, larkDelta.y);

        // CCW rotation: subtract angle
        const larkAngle = larkAngle0 - angle;
        const robinAngle = larkAngle + Math.PI;

        dancers[lark].pos = new Vector(
          center.x + radius * Math.sin(larkAngle),
          center.y + radius * Math.cos(larkAngle),
        );
        dancers[robin].pos = new Vector(
          center.x + radius * Math.sin(robinAngle),
          center.y + radius * Math.cos(robinAngle),
        );

        // Face across from current position
        dancers[lark].facing = headingVector(larkAngle0 - angle);
        dancers[robin].facing = headingVector(larkAngle0 - angle + Math.PI);

        courtesyHands.push({ a: makeDancerId(lark, 0), ha: 'left', b: makeDancerId(robin, 0), hb: 'left' });
        courtesyHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'right' });
      }

      result.push({ beat, dancers, hands: courtesyHands });
    }
  }

  return result;
}
