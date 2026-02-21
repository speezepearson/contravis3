import type { Keyframe, AtomicInstruction, ProtoDancerId } from '../types';
import { parseDancerId, dancerPosition, EAST, WEST } from '../types';
import { copyDancers, easeInOut, ellipsePosition, resolvePairs } from '../generateUtils';

export function generateMadRobin(
  prev: Keyframe,
  instr: Extract<AtomicInstruction, { type: "mad_robin" }>,
  scope: Set<ProtoDancerId>,
): Keyframe[] {
  const relationship =
    instr.with === "larks_left"
      ? ("larks_left_robins_right" as const)
      : ("larks_right_robins_left" as const);
  const pairs = resolvePairs(relationship, prev.dancers, scope, {});

  const cw =
    (instr.dir === "larks_in_middle") === (instr.with === "robins_left");
  const totalAngleRad = instr.rotations * 2 * Math.PI * (cw ? 1 : -1);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  // Assert same side of set and build orbit data
  const checked = new Set<ProtoDancerId>();
  const orbitData: {
    protoId: ProtoDancerId;
    startPos: { x: number; y: number };
    partnerPos: { x: number; y: number };
    acrossFacing: number;
  }[] = [];

  for (const [id, targetDancerId] of pairs) {
    const { proto: targetProto } = parseDancerId(targetDancerId);
    if (!checked.has(id) && !checked.has(targetProto)) {
      checked.add(id);
      checked.add(targetProto);
      const da = prev.dancers[id];
      const db = dancerPosition(targetDancerId, prev.dancers);
      if (da.x * db.x < -1e-6) {
        throw new Error(
          `mad robin: ${id} and ${targetProto} are not on the same side of the set`,
        );
      }
    }

    const da = prev.dancers[id];
    const targetPos = dancerPosition(targetDancerId, prev.dancers);

    orbitData.push({
      protoId: id,
      startPos: { x: da.x, y: da.y },
      partnerPos: { x: targetPos.x, y: targetPos.y },
      acrossFacing: da.x < 0 ? EAST : WEST,
    });
  }

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const phi = easeInOut(t) * totalAngleRad;
    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      const pos = ellipsePosition(od.startPos, od.partnerPos, 0.25, phi);
      dancers[od.protoId].x = pos.x;
      dancers[od.protoId].y = pos.y;
      dancers[od.protoId].facing = od.acrossFacing;
    }
    result.push({ beat, dancers, hands: prev.hands });
  }
  return result;
}
