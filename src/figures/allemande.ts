import type { Keyframe, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../types';
import { Vector, makeDancerId, dancerPosition, headingVector, makeFinalKeyframe } from '../types';
import { copyDancers, easeInOut, resolvePairs } from '../generateUtils';

type OrbitDatum = { protoId: ProtoDancerId; center: Vector; startAngle: number; radius: number };

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>) {
  const totalAngleRad = instr.rotations * 2 * Math.PI * (instr.handedness === 'right' ? 1 : -1);
  // shoulderOffset: right-hand allemande → face 90° CCW from center (i.e. -π/2), left → 90° CW (+π/2)
  const shoulderOffset = instr.handedness === 'right' ? -Math.PI / 2 : Math.PI / 2;
  const pairs = resolvePairs(instr.relationship, prev.dancers, scope, {});

  const handsSeen = new Set<string>();
  const allemandHands: HandConnection[] = [];
  const orbitData: OrbitDatum[] = [];
  for (const [id, target] of pairs) {
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!handsSeen.has(key)) {
      handsSeen.add(key);
      allemandHands.push({ a: aId, ha: instr.handedness, b: target, hb: instr.handedness });
    }
    const da = prev.dancers[id];
    const partnerPos = dancerPosition(target, prev.dancers).pos;
    const center = da.pos.add(partnerPos).multiply(0.5);
    const delta = da.pos.subtract(center);
    orbitData.push({
      protoId: id, center,
      startAngle: Math.atan2(delta.x, delta.y),
      radius: delta.length(),
    });
  }

  return { totalAngleRad, shoulderOffset, allemandHands, orbitData };
}

export function finalAllemande(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { totalAngleRad, shoulderOffset, allemandHands, orbitData } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const od of orbitData) {
    const angle = od.startAngle + totalAngleRad;
    dancers[od.protoId].pos = new Vector(
      od.center.x + od.radius * Math.sin(angle),
      od.center.y + od.radius * Math.cos(angle),
    );
    const dirToCenter = Math.atan2(od.center.x - dancers[od.protoId].pos.x, od.center.y - dancers[od.protoId].pos.y);
    dancers[od.protoId].facing = headingVector(dirToCenter + shoulderOffset);
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: [...prev.hands, ...allemandHands],
  });
}

export function generateAllemande(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { totalAngleRad, shoulderOffset, allemandHands, orbitData } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));
  const hands = [...prev.hands, ...allemandHands];

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const angleOffset = tEased * totalAngleRad;

    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      const angle = od.startAngle + angleOffset;
      dancers[od.protoId].pos = new Vector(
        od.center.x + od.radius * Math.sin(angle),
        od.center.y + od.radius * Math.cos(angle),
      );
      const dirToCenter = Math.atan2(od.center.x - dancers[od.protoId].pos.x, od.center.y - dancers[od.protoId].pos.y);
      dancers[od.protoId].facing = headingVector(dirToCenter + shoulderOffset);
    }

    result.push({ beat, dancers, hands });
  }

  return result;
}
