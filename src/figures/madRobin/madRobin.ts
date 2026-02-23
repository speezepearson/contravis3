import type { Keyframe, FinalKeyframe, AtomicInstruction, ProtoDancerId } from '../../types';
import { type Vector, parseDancerId, dancerPosition, EAST, WEST, makeFinalKeyframe } from '../../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs } from '../../generateUtils';

type OrbitDatum = {
  protoId: ProtoDancerId;
  startPos: Vector;
  partnerPos: Vector;
  acrossFacing: Vector;
};

function setup(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: "mad_robin" }>,
  scope: Set<ProtoDancerId>,
) {
  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});

  // Determine orbit direction from the position of a "middle" role dancer:
  // they need to orbit toward x=0 (center of the set).
  const middleRole = instr.dir === "larks_in_middle" ? "lark" : "robin";
  let cw = true;
  for (const [id, targetDancerId] of pairs) {
    if (id.includes(middleRole)) {
      const s = prev.dancers[id].pos;
      const t = dancerPosition(targetDancerId, prev.dancers).pos;
      const dy = (s.y - t.y) / 2; // offset from orbit center
      // Positive phi moves middle dancer in x by semiMinor * dy / semiMajor.
      // For them to head toward x=0, we need sign(phi) = sign(-s.x * dy).
      if (Math.abs(s.x * dy) > 1e-9) {
        cw = s.x * dy < 0;
      }
      break;
    }
  }
  const totalAngleRad = instr.rotations * 2 * Math.PI * (cw ? 1 : -1);

  // Assert pairs are close enough to orbit together
  const checked = new Set<ProtoDancerId>();
  const orbitData: OrbitDatum[] = [];

  for (const [id, targetDancerId] of pairs) {
    const { proto: targetProto } = parseDancerId(targetDancerId);
    if (!checked.has(id) && !checked.has(targetProto)) {
      checked.add(id);
      checked.add(targetProto);
      const da = prev.dancers[id];
      const db = dancerPosition(targetDancerId, prev.dancers);
      const dist = da.pos.subtract(db.pos).length();
      if (dist > 1.8) {
        throw new Error(
          `mad robin: ${id} and ${targetProto} are ${dist.toFixed(2)}m apart (max 1.8m)`,
        );
      }
    }

    const da = prev.dancers[id];
    const targetPos = dancerPosition(targetDancerId, prev.dancers).pos;

    orbitData.push({
      protoId: id,
      startPos: da.pos,
      partnerPos: targetPos,
      acrossFacing: da.pos.x < 0 ? EAST : WEST,
    });
  }

  return { totalAngleRad, orbitData };
}

export function finalMadRobin(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: "mad_robin" }>,
  scope: Set<ProtoDancerId>,
): FinalKeyframe {
  const { totalAngleRad, orbitData } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const od of orbitData) {
    dancers[od.protoId].pos = ellipsePosition(od.startPos, od.partnerPos, 0.25, totalAngleRad);
    dancers[od.protoId].facing = od.acrossFacing;
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  });
}

export function generateMadRobin(
  prev: Keyframe,
  _final: FinalKeyframe,
  instr: Extract<AtomicInstruction, { type: "mad_robin" }>,
  scope: Set<ProtoDancerId>,
): Keyframe[] {
  const { totalAngleRad, orbitData } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const phi = easeInOut(t) * totalAngleRad;
    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      dancers[od.protoId].pos = ellipsePosition(od.startPos, od.partnerPos, 0.25, phi);
      dancers[od.protoId].facing = od.acrossFacing;
    }
    result.push({ beat, dancers, hands: prev.hands });
  }
  return result;
}
