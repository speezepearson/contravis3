import type { Keyframe, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../types';
import { makeDancerId, dancerPosition, normalizeBearing, QUARTER_CW, QUARTER_CCW, FULL_CW, makeFinalKeyframe } from '../types';
import { copyDancers, easeInOut, resolvePairs } from '../generateUtils';

type OrbitDatum = { protoId: ProtoDancerId; cx: number; cy: number; startAngle: number; radius: number };

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>) {
  const totalAngleRad = instr.rotations * FULL_CW * (instr.handedness === 'right' ? 1 : -1);
  const shoulderOffset = instr.handedness === 'right' ? QUARTER_CCW : QUARTER_CW;
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
    const partnerPos = dancerPosition(target, prev.dancers);
    const cx = (da.x + partnerPos.x) / 2;
    const cy = (da.y + partnerPos.y) / 2;
    orbitData.push({
      protoId: id, cx, cy,
      startAngle: Math.atan2(da.x - cx, da.y - cy),
      radius: Math.hypot(da.x - cx, da.y - cy),
    });
  }

  return { totalAngleRad, shoulderOffset, allemandHands, orbitData };
}

export function finalAllemande(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { totalAngleRad, shoulderOffset, allemandHands, orbitData } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const od of orbitData) {
    const angle = od.startAngle + totalAngleRad;
    dancers[od.protoId].x = od.cx + od.radius * Math.sin(angle);
    dancers[od.protoId].y = od.cy + od.radius * Math.cos(angle);
    const dirToCenter = Math.atan2(od.cx - dancers[od.protoId].x, od.cy - dancers[od.protoId].y);
    dancers[od.protoId].facing = normalizeBearing(dirToCenter + shoulderOffset);
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
      dancers[od.protoId].x = od.cx + od.radius * Math.sin(angle);
      dancers[od.protoId].y = od.cy + od.radius * Math.cos(angle);
      const dirToCenter = Math.atan2(od.cx - dancers[od.protoId].x, od.cy - dancers[od.protoId].y);
      dancers[od.protoId].facing = normalizeBearing(dirToCenter + shoulderOffset);
    }

    result.push({ beat, dancers, hands });
  }

  return result;
}
