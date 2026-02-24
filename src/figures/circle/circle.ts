import type { Keyframe, KeyframeFn, FinalKeyframe, AtomicInstruction, HandConnection, ProtoDancerId } from '../../types';
import { Vector, makeDancerId, makeFinalKeyframe } from '../../types';
import { PROTO_DANCER_IDS, averagePos, copyDancers, findDancerOnSide } from '../../generateUtils';

  type OrbitDatum = { protoId: ProtoDancerId; initOffsetFromCenter: Vector; radius: number };

function setup(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>) {
  const sign = instr.direction === 'left' ? -1 : 1;
  const totalAngleRad = sign * instr.rotations * 2 * Math.PI;

  // Compute center of all scoped dancers
  let center = averagePos([...scope].map(id => prev.dancers[id].pos));

  const orbitData: OrbitDatum[] = [];
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    const delta = d.pos.subtract(center);
    orbitData.push({
      protoId: id,
      initOffsetFromCenter: d.pos.subtract(center),
      radius: delta.length(),
    });
  }

  // Build ring hand connections
  const hands: HandConnection[] = [];
  for (const id of scope) {
    const left = findDancerOnSide(id, 'on_left', prev.dancers);
    if (!left) throw new Error(`circle: ${id} has no dancer on their left`);
    const leftId = left.dancerId;
    hands.push({ a: makeDancerId(id, 0), ha: 'left', b: leftId, hb: 'right' });
    // shouldn't need to handle the dancer's right hand; the dancer on their right should take it with their left
  }

  return { totalAngleRad, center, orbitData, hands };
}

export function finalCircle(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>): FinalKeyframe {
  const { totalAngleRad, center, orbitData, hands } = setup(prev, instr, scope);

  const dancers = copyDancers(prev.dancers);
  for (const od of orbitData) {
    dancers[od.protoId].pos = center.add(od.initOffsetFromCenter.rotateByRadians(totalAngleRad));
    dancers[od.protoId].facing = center.subtract(dancers[od.protoId].pos).normalize();
  }

  return makeFinalKeyframe({ beat: prev.beat + instr.beats, dancers, hands });
}

export function generateCircle(prev: Keyframe, _final: FinalKeyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>): KeyframeFn {
  const { totalAngleRad, center, orbitData, hands } = setup(prev, instr, scope);

  return (t: number) => {
    const beat = prev.beat + t * instr.beats;
    const angleOffset = t * totalAngleRad;
    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      dancers[od.protoId].pos = center.add(od.initOffsetFromCenter.rotateByRadians(angleOffset));
      dancers[od.protoId].facing = center.subtract(dancers[od.protoId].pos).normalize();
    }
    return { beat, dancers, hands };
  };
}
