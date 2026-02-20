import type { Keyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../types';
import { makeDancerId, normalizeBearing } from '../types';
import { PROTO_DANCER_IDS, copyDancers, easeInOut, insideHandInRing } from '../generateUtils';

export function generateCircle(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  // All scoped dancers orbit around their common center
  // Left = CW (positive angle), Right = CCW (negative angle)
  const sign = instr.direction === 'left' ? 1 : -1;
  const totalAngleRad = sign * instr.rotations * 2 * Math.PI;
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  // Compute center of all scoped dancers
  let cx = 0, cy = 0, count = 0;
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    cx += prev.dancers[id].x;
    cy += prev.dancers[id].y;
    count++;
  }
  cx /= count;
  cy /= count;

  const orbitData: { protoId: ProtoDancerId; startAngle: number; radius: number }[] = [];
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    orbitData.push({
      protoId: id,
      startAngle: Math.atan2(d.x - cx, d.y - cy),
      radius: Math.hypot(d.x - cx, d.y - cy),
    });
  }

  // Build ring hand connections
  const sorted = [...orbitData].sort((a, b) => a.startAngle - b.startAngle);
  const ringHands: HandConnection[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const cd = prev.dancers[curr.protoId];
    const nd = prev.dancers[next.protoId];
    const a = makeDancerId(curr.protoId, 0);
    const b = makeDancerId(next.protoId, 0);
    const ha = insideHandInRing(cd, nd, curr.startAngle, next.startAngle);
    const hb = insideHandInRing(nd, cd, next.startAngle, curr.startAngle);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const [loH, hiH] = a < b ? [ha, hb] : [hb, ha];
    ringHands.push({ a: lo, ha: loH, b: hi, hb: hiH });
  }
  const hands = [...prev.hands, ...ringHands];

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const angleOffset = tEased * totalAngleRad;
    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      const angle = od.startAngle + angleOffset;
      dancers[od.protoId].x = cx + od.radius * Math.sin(angle);
      dancers[od.protoId].y = cy + od.radius * Math.cos(angle);
      // Face center
      dancers[od.protoId].facing = normalizeBearing(Math.atan2(cx - dancers[od.protoId].x, cy - dancers[od.protoId].y));
    }
    result.push({ beat, dancers, hands });
  }
  return result;
}
