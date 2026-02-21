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
  const relationship =
    instr.with === "larks_left"
      ? ("larks_left_robins_right" as const)
      : ("larks_right_robins_left" as const);
  const pairs = resolvePairs(relationship, prev.dancers, scope, {});

  const cw =
    (instr.dir === "larks_in_middle") === (instr.with === "robins_left");
  const totalAngleRad = instr.rotations * 2 * Math.PI * (cw ? 1 : -1);

  // Assert same side of set and build orbit data
  const checked = new Set<ProtoDancerId>();
  const orbitData: OrbitDatum[] = [];

  for (const [id, targetDancerId] of pairs) {
    const { proto: targetProto } = parseDancerId(targetDancerId);
    if (!checked.has(id) && !checked.has(targetProto)) {
      checked.add(id);
      checked.add(targetProto);
      const da = prev.dancers[id];
      const db = dancerPosition(targetDancerId, prev.dancers);
      if (da.pos.x * db.pos.x < -1e-6) {
        throw new Error(
          `mad robin: ${id} and ${targetProto} are not on the same side of the set`,
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
