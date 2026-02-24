import type { Keyframe, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../../types';
import { Vector, makeDancerId, dancerPosition, makeFinalKeyframe } from '../../types';
import { copyDancers, resolvePairs } from '../../generateUtils';

type OrbitDatum = { protoId: ProtoDancerId; center: Vector; initOffsetFromCenter: Vector };

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>) {
  const totalAngleRad = instr.rotations * 2 * Math.PI * (instr.handedness === 'right' ? -1 : 1);
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
    orbitData.push({
      protoId: id, center,
      initOffsetFromCenter: da.pos.subtract(center),
    });
  }

  return { totalAngleRad, shoulderOffset, allemandHands, orbitData };
}

export function finalAllemande(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { totalAngleRad, allemandHands, orbitData } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const od of orbitData) {
    dancers[od.protoId].pos = od.center.add(od.initOffsetFromCenter.rotateByRadians(totalAngleRad));
    dancers[od.protoId].facing = dancers[od.protoId].pos.subtract(od.center).normalize().rotateByDegrees(instr.handedness === 'right' ? -90 : 90)
  }

  return makeFinalKeyframe({
    beat: prev.beat + instr.beats,
    dancers,
    hands: [...prev.hands, ...allemandHands],
  });
}

export function generateAllemande(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { totalAngleRad, allemandHands, orbitData } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));
  const hands = [...prev.hands, ...allemandHands];

  const result: Keyframe[] = [];
  for (let i = 1; i < nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const angleOffset = t * totalAngleRad;

    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      dancers[od.protoId].pos = od.center.add(od.initOffsetFromCenter.rotateByRadians(angleOffset));
      dancers[od.protoId].facing = dancers[od.protoId].pos.subtract(od.center).normalize().rotateByDegrees(instr.handedness === 'right' ? -90 : 90)
    }

    result.push({ beat, dancers, hands });
  }

  return result;
}
