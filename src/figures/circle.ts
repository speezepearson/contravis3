import type { Keyframe, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../types';
import { Vector, makeDancerId, makeFinalKeyframe } from '../types';
import { PROTO_DANCER_IDS, copyDancers, easeInOut, insideHandInRing } from '../generateUtils';

type OrbitDatum = { protoId: ProtoDancerId; startAngle: number; radius: number };

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>) {
  const sign = instr.direction === 'left' ? 1 : -1;
  const totalAngleRad = sign * instr.rotations * 2 * Math.PI;

  // Compute center of all scoped dancers
  let cx = 0, cy = 0, count = 0;
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    cx += prev.dancers[id].pos.x;
    cy += prev.dancers[id].pos.y;
    count++;
  }
  cx /= count;
  cy /= count;

  const orbitData: OrbitDatum[] = [];
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    const delta = d.pos.subtract(new Vector(cx, cy));
    orbitData.push({
      protoId: id,
      startAngle: Math.atan2(delta.x, delta.y),
      radius: delta.length(),
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

  return { totalAngleRad, cx, cy, orbitData, hands };
}

export function finalCircle(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { totalAngleRad, cx, cy, orbitData, hands } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const od of orbitData) {
    const angle = od.startAngle + totalAngleRad;
    dancers[od.protoId].pos = new Vector(
      cx + od.radius * Math.sin(angle),
      cy + od.radius * Math.cos(angle),
    );
    dancers[od.protoId].facing = new Vector(cx, cy).subtract(dancers[od.protoId].pos).normalize();
  }

  return makeFinalKeyframe({ beat: prev.beat + instr.beats, dancers, hands });
}

export function generateCircle(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const { totalAngleRad, cx, cy, orbitData, hands } = setup(prev, instr, scope);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

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
        cx + od.radius * Math.sin(angle),
        cy + od.radius * Math.cos(angle),
      );
      // Face center
      dancers[od.protoId].facing = new Vector(cx, cy).subtract(dancers[od.protoId].pos).normalize();
    }
    result.push({ beat, dancers, hands });
  }
  return result;
}
