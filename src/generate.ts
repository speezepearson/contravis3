import type { Instruction, AtomicInstruction, Keyframe, Relationship, RelativeDirection, DancerState, HandConnection, ProtoDancerId, DancerId, InitFormation, InstructionId } from './types';
import { makeDancerId, parseDancerId, dancerPosition, ProtoDancerIdSchema, buildDancerRecord } from './types';
import { assertNever } from './utils';

const PROTO_DANCER_IDS = ProtoDancerIdSchema.options;
const ALL_DANCERS = new Set<ProtoDancerId>(PROTO_DANCER_IDS);

const UPS = new Set<ProtoDancerId>(['up_lark_0', 'up_robin_0']);

const STATIC_RELATIONSHIPS: Record<'partner' | 'neighbor' | 'opposite', Record<ProtoDancerId, ProtoDancerId>> = {
  partner:  { up_lark_0: 'up_robin_0', up_robin_0: 'up_lark_0', down_lark_0: 'down_robin_0', down_robin_0: 'down_lark_0' },
  neighbor: { up_lark_0: 'down_robin_0', up_robin_0: 'down_lark_0', down_lark_0: 'up_robin_0', down_robin_0: 'up_lark_0' },
  opposite: { up_lark_0: 'down_lark_0', up_robin_0: 'down_robin_0', down_lark_0: 'up_lark_0', down_robin_0: 'up_robin_0' },
};

const SPLIT_GROUPS: Record<'role' | 'position', [Set<ProtoDancerId>, Set<ProtoDancerId>]> = {
  role:     [new Set(['up_lark_0', 'down_lark_0']), new Set(['up_robin_0', 'down_robin_0'])],
  position: [new Set(['up_lark_0', 'up_robin_0']), new Set(['down_lark_0', 'down_robin_0'])],
};

function initialKeyframe(initFormation: InitFormation = 'improper'): Keyframe {
  if (initFormation === 'beckett') {
    return {
      beat: 0,
      dancers: {
        up_lark_0:    { x: -0.5, y:  0.5, facing: 90 },
        up_robin_0:   { x: -0.5, y: -0.5, facing: 90 },
        down_lark_0:  { x:  0.5, y: -0.5, facing: 270 },
        down_robin_0: { x:  0.5, y:  0.5, facing: 270 },
      },
      hands: [],
    };
  }
  return {
    beat: 0,
    dancers: {
      up_lark_0:    { x: -0.5, y: -0.5, facing: 0 },
      up_robin_0:   { x:  0.5, y: -0.5, facing: 0 },
      down_lark_0:  { x:  0.5, y:  0.5, facing: 180 },
      down_robin_0: { x: -0.5, y:  0.5, facing: 180 },
    },
    hands: [],
  };
}

function copyDancers(dancers: Record<ProtoDancerId, DancerState>): Record<ProtoDancerId, DancerState> {
  return buildDancerRecord(id => {
    const d = dancers[id];
    return { x: d.x, y: d.y, facing: d.facing };
  });
}

/** Resolve a relationship from a specific dancer's perspective.
 *  Returns the DancerId of the target, which may be in an adjacent hands-four. */
function resolveRelationship(relationship: Relationship, id: ProtoDancerId, dancers: Record<ProtoDancerId, DancerState>): DancerId {
  switch (relationship) {
    case 'partner': case 'neighbor': case 'opposite':
      return makeDancerId(STATIC_RELATIONSHIPS[relationship][id], 0);
    case 'on_right': case 'on_left': case 'in_front': {
      // Bias towards people in front of the dancer vs behind,
      // since those loom larger in their attention.
      const angleOffset = relationship === 'on_right' ? 70 : relationship === 'on_left' ? -70 : relationship === 'in_front' ? 0 : assertNever(relationship);
      const d = dancers[id];
      const headingRad = (d.facing + angleOffset) * Math.PI / 180;
      const ux = Math.sin(headingRad);
      const uy = Math.cos(headingRad);

      let bestScore = Infinity;
      let bestTarget: DancerId | null = null;

      for (const otherId of PROTO_DANCER_IDS) {
        if (otherId === id) continue;
        // Find the 5 offsets whose dancers are closest to this dancer
        const dyBase = dancers[otherId].y - d.y;
        const oBest = Math.round(-dyBase / 2);
        for (let o = oBest - 2; o <= oBest + 2; o++) {
          const targetId = makeDancerId(otherId, o);
          const targetPos = dancerPosition(targetId, dancers);
          const dx = targetPos.x - d.x;
          const dy = targetPos.y - d.y;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r > 1.2 || r < 1e-9) continue;

          const cosTheta = (ux * dx + uy * dy) / r;
          if (cosTheta < 0) continue;
          const cos2Theta = 2 * cosTheta * cosTheta - 1;
          if (cos2Theta < 0.01) continue;

          const score = r / cos2Theta;
          if (score < bestScore) {
            bestScore = score;
            bestTarget = targetId;
          }
        }
      }

      if (bestTarget === null) {
        throw new Error(`resolveRelationship: no valid candidate for '${relationship}' from ${id}`);
      }
      return bestTarget;
    }
    default: return assertNever(relationship);
  }
}

function easeInOut(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

/** Resolve a RelativeDirection to an absolute heading in radians for a specific dancer.
 *  Uses atan2(dx,dy) convention: 0 = +y (north/up on screen). */
function resolveHeading(dir: RelativeDirection, d: DancerState, id: ProtoDancerId, dancers: Record<ProtoDancerId, DancerState>): number {
  if (dir.kind === 'direction') {
    switch (dir.value) {
      case 'up':               return 0;
      case 'down':             return Math.PI;
      case 'across':           return d.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      case 'out':              return d.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      case 'progression':      return UPS.has(id) ? 0 : Math.PI;
      case 'forward':          return d.facing * Math.PI / 180;
      case 'back':             return (d.facing + 180) * Math.PI / 180;
      case 'right':            return (d.facing + 90) * Math.PI / 180;
      case 'left':             return (d.facing - 90) * Math.PI / 180;
    }
  }
  // relationship: toward the matched partner
  const targetDancerId = resolveRelationship(dir.value, id, dancers);
  const t = dancerPosition(targetDancerId, dancers);
  return Math.atan2(t.x - d.x, t.y - d.y);
}

/** Resolve a RelativeDirection to an absolute facing in degrees. */
function resolveFacing(dir: RelativeDirection, d: DancerState, id: ProtoDancerId, dancers: Record<ProtoDancerId, DancerState>): number {
  const heading = resolveHeading(dir, d, id, dancers);
  return ((heading * 180 / Math.PI) % 360 + 360) % 360;
}

// --- Per-instruction generators ---

/** Determine a dancer's inside hand (the hand closer to the target).
 *  Throws if the target is directly in front of or behind the dancer. */
function resolveInsideHand(dancer: DancerState, target: DancerState): 'left' | 'right' {
  const heading = Math.atan2(target.x - dancer.x, target.y - dancer.y) * 180 / Math.PI;
  const rel = ((heading - dancer.facing + 540) % 360) - 180;
  if (Math.abs(rel) < 1e-9 || Math.abs(Math.abs(rel) - 180) < 1e-9) {
    throw new Error('Cannot determine inside hand: target is neither to the left nor to the right');
  }
  return rel > 0 ? 'right' : 'left';
}

function generateTakeHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'take_hands' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const newHands: HandConnection[] = [...prev.hands];
  const seen = new Set<string>();
  if (instr.hand === 'inside') {
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const target = resolveRelationship(instr.relationship, id, prev.dancers);
      const aId = makeDancerId(id, 0);
      const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
      if (!seen.has(key)) {
        seen.add(key);
        const aState = prev.dancers[id];
        const bState = dancerPosition(target, prev.dancers);
        const ha = resolveInsideHand(aState, bState);
        const hb = resolveInsideHand(bState, aState);
        newHands.push({ a: aId, ha, b: target, hb });
      }
    }
  } else {
    const hands: ('left' | 'right')[] = instr.hand === 'both' ? ['left', 'right'] : [instr.hand];
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const target = resolveRelationship(instr.relationship, id, prev.dancers);
      const aId = makeDancerId(id, 0);
      const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
      if (!seen.has(key)) {
        seen.add(key);
        for (const h of hands) {
          newHands.push({ a: aId, ha: h, b: target, hb: h });
        }
      }
    }
  }
  return [{
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: newHands,
  }];
}

function generateDropHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'drop_hands' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const target = instr.target;
  let newHands: HandConnection[];

  if (target === 'both') {
    // Drop all hand connections involving scoped dancers
    newHands = prev.hands.filter(h => !scope.has(parseDancerId(h.a).proto) && !scope.has(parseDancerId(h.b).proto));
  } else if (target === 'left' || target === 'right') {
    // Drop connections where a scoped dancer uses that hand
    newHands = prev.hands.filter(h => {
      if (scope.has(parseDancerId(h.a).proto) && h.ha === target) return false;
      if (scope.has(parseDancerId(h.b).proto) && h.hb === target) return false;
      return true;
    });
  } else {
    // It's a Relationship — drop hands between those pairs
    const pairSet = new Set<string>();
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const resolved = resolveRelationship(target, id, prev.dancers);
      const aId = makeDancerId(id, 0);
      pairSet.add(`${aId}:${resolved}`);
      pairSet.add(`${resolved}:${aId}`);
    }
    newHands = prev.hands.filter(h => !pairSet.has(`${h.a}:${h.b}`));
  }

  return [{
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: newHands,
  }];
}

function generateAllemande(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  // right = CW, left = CCW
  const totalAngleDeg = instr.rotations * 360 * (instr.handedness === 'right' ? 1 : -1);
  const totalAngleRad = totalAngleDeg * Math.PI / 180;
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));
  // Shoulder offset: right hand → face 90° CCW from partner; left → 90° CW
  const shoulderOffset = instr.handedness === 'right' ? -90 : 90;

  // Build hand connections and orbit data from per-dancer resolution
  const handsSeen = new Set<string>();
  const allemandHands: HandConnection[] = [];
  const orbitData: { protoId: ProtoDancerId; cx: number; cy: number; startAngle: number; radius: number }[] = [];
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    // Hand connection (deduped)
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!handsSeen.has(key)) {
      handsSeen.add(key);
      allemandHands.push({ a: aId, ha: instr.handedness, b: target, hb: instr.handedness });
    }
    // Orbit: each dancer orbits independently around center with their resolved partner
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
  const hands = [...prev.hands, ...allemandHands];
  const result: Keyframe[] = [];

  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const angleOffset = tEased * totalAngleRad;

    const dancers = copyDancers(prev.dancers);

    for (const od of orbitData) {
      const angle = od.startAngle + angleOffset;
      dancers[od.protoId].x = od.cx + od.radius * Math.sin(angle);
      dancers[od.protoId].y = od.cy + od.radius * Math.cos(angle);
      const dirToCenter = Math.atan2(od.cx - dancers[od.protoId].x, od.cy - dancers[od.protoId].y) * 180 / Math.PI;
      dancers[od.protoId].facing = ((dirToCenter + shoulderOffset) % 360 + 360) % 360;
    }

    result.push({ beat, dancers, hands });
  }

  return result;
}

function generateTurn(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'turn' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const dancers = copyDancers(prev.dancers);

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const base = resolveFacing(instr.target, prev.dancers[id], id, prev.dancers);
    dancers[id].facing = ((base + instr.offset) % 360 + 360) % 360;
  }

  return [{
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  }];
}

function generateStep(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'step' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const displacements: Partial<Record<ProtoDancerId, { dx: number; dy: number }>> = {};
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const d = prev.dancers[id];
    const heading = resolveHeading(instr.direction, d, id, prev.dancers);
    displacements[id] = {
      dx: Math.sin(heading) * instr.distance,
      dy: Math.cos(heading) * instr.distance,
    };
  }

  const keyframes: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(prev.dancers);
    for (const id of PROTO_DANCER_IDS) {
      const disp = displacements[id];
      if (!disp) continue;
      dancers[id].x = prev.dancers[id].x + disp.dx * tEased;
      dancers[id].y = prev.dancers[id].y + disp.dy * tEased;
    }
    keyframes.push({ beat, dancers, hands: prev.hands });
  }
  return keyframes;
}

function generateBalance(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'balance' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const halfBeats = instr.beats / 2;
  const stepOut = { id: instr.id, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: instr.distance };
  const outFrames = generateStep(prev, stepOut, scope);
  const lastOut = outFrames.length > 0 ? outFrames[outFrames.length - 1] : prev;
  const stepBack = { id: instr.id, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: -instr.distance };
  const backFrames = generateStep(lastOut, stepBack, scope);
  return [...outFrames, ...backFrames];
}

function generateDoSiDo(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'do_si_do' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  // Like allemande but dancers maintain original facing and no hand connections
  const totalAngleRad = instr.rotations * 2 * Math.PI; // always CW (pass right shoulders)
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const SEMI_MINOR = 0.25; // perpendicular axis half-width (0.5m total)
  const orbitData: { protoId: ProtoDancerId; cx: number; cy: number; startAngle: number; semiMajor: number; originalFacing: number }[] = [];
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    const da = prev.dancers[id];
    const partnerPos = dancerPosition(target, prev.dancers);
    const cx = (da.x + partnerPos.x) / 2;
    const cy = (da.y + partnerPos.y) / 2;
    orbitData.push({
      protoId: id, cx, cy,
      startAngle: Math.atan2(da.x - cx, da.y - cy),
      semiMajor: Math.hypot(da.x - cx, da.y - cy),
      originalFacing: da.facing,
    });
  }

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const phase = tEased * totalAngleRad;
    const dancers = copyDancers(prev.dancers);
    for (const od of orbitData) {
      // Elliptical orbit: major axis along the dancers' starting line, minor axis perpendicular.
      // Decompose into axis-aligned components using the starting angle.
      const cosPhase = Math.cos(phase);
      const sinPhase = Math.sin(phase);
      const sinStart = Math.sin(od.startAngle);
      const cosStart = Math.cos(od.startAngle);
      dancers[od.protoId].x = od.cx + od.semiMajor * cosPhase * sinStart + SEMI_MINOR * sinPhase * cosStart;
      dancers[od.protoId].y = od.cy + od.semiMajor * cosPhase * cosStart - SEMI_MINOR * sinPhase * sinStart;
      dancers[od.protoId].facing = od.originalFacing; // maintain original facing
    }
    result.push({ beat, dancers, hands: prev.hands });
  }
  return result;
}

/** Determine a dancer's inside hand toward a neighbor in a ring where dancers face center.
 *  Uses the cross product of facing direction and direction to target.
 *  Falls back on angular ordering when they are directly in front/behind. */
function insideHandInRing(dancer: DancerState, target: DancerState, dancerAngle: number, targetAngle: number): 'left' | 'right' {
  const facingRad = dancer.facing * Math.PI / 180;
  const fx = Math.sin(facingRad);
  const fy = Math.cos(facingRad);
  const dx = target.x - dancer.x;
  const dy = target.y - dancer.y;
  const cross = fx * dy - fy * dx;
  if (Math.abs(cross) > 1e-9) {
    return cross < 0 ? 'right' : 'left';
  }
  // Degenerate case: neighbor directly ahead/behind. Use ring angular ordering:
  // "next" in ascending angle (CCW from above) is to our right when facing center.
  let angleDiff = targetAngle - dancerAngle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  return angleDiff > 0 ? 'right' : 'left';
}

function generateCircle(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>): Keyframe[] {
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

  // Build ring hand connections: sort dancers by their starting angle, connect adjacent pairs.
  // Each dancer uses their inside hand (the one closest to the neighbor).
  // Since dancers face center, we determine left/right using the cross product of
  // the facing vector and the vector to the neighbor. When the neighbor is directly
  // ahead/behind (cross product ≈ 0), we fall back on the ring's angular ordering.
  const sorted = [...orbitData].sort((a, b) => a.startAngle - b.startAngle);
  const ringHands: HandConnection[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const cd = prev.dancers[curr.protoId];
    const nd = prev.dancers[next.protoId];
    const a = makeDancerId(curr.protoId, 0);
    const b = makeDancerId(next.protoId, 0);
    // Determine which hand curr uses toward next (inside hand)
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
      const facingRad = Math.atan2(cx - dancers[od.protoId].x, cy - dancers[od.protoId].y);
      dancers[od.protoId].facing = ((facingRad * 180 / Math.PI) % 360 + 360) % 360;
    }
    result.push({ beat, dancers, hands });
  }
  return result;
}

function generatePullBy(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'pull_by' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  // Build swap pairs with ellipse parameters and hand connections
  const swapData: {
    protoId: ProtoDancerId; originalFacing: number;
    cx: number; cy: number; semiMajor: number;
    majorX: number; majorY: number; perpX: number; perpY: number;
  }[] = [];
  const pullHands: HandConnection[] = [];
  const seen = new Set<string>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    const da = prev.dancers[id];
    const targetPos = dancerPosition(target, prev.dancers);
    // Ellipse: major axis from start to target, minor axis = half of major
    const dx = targetPos.x - da.x;
    const dy = targetPos.y - da.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const majorX = dist > 0 ? dx / dist : 1;
    const majorY = dist > 0 ? dy / dist : 0;
    // Perpendicular: CW for right hand, CCW for left hand
    const sign = instr.hand === 'right' ? -1 : 1;
    const perpX = sign * majorY;
    const perpY = sign * -majorX;
    swapData.push({
      protoId: id, originalFacing: da.facing,
      cx: (da.x + targetPos.x) / 2, cy: (da.y + targetPos.y) / 2,
      semiMajor: dist / 2, majorX, majorY, perpX, perpY,
    });
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!seen.has(key)) {
      seen.add(key);
      pullHands.push({ a: aId, ha: instr.hand, b: target, hb: instr.hand });
    }
  }
  const hands = [...prev.hands, ...pullHands];

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(prev.dancers);
    for (const sd of swapData) {
      // Sweep from θ=π (start) to θ=0 (target) along an ellipse
      const theta = Math.PI * (1 - tEased);
      const semiMinor = sd.semiMajor / 2;
      dancers[sd.protoId].x = sd.cx + sd.semiMajor * Math.cos(theta) * sd.majorX + semiMinor * Math.sin(theta) * sd.perpX;
      dancers[sd.protoId].y = sd.cy + sd.semiMajor * Math.cos(theta) * sd.majorY + semiMinor * Math.sin(theta) * sd.perpY;
      dancers[sd.protoId].facing = sd.originalFacing; // maintain facing
    }
    result.push({ beat, dancers, hands });
  }
  return result;
}

function isLark(id: ProtoDancerId): boolean {
  return id === 'up_lark_0' || id === 'down_lark_0';
}

function generateSwing(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'swing' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const FRONT = 0.15;
  const RIGHT = 0.1;
  // Phase offset: angle from CoM to lark (in heading convention) when lark faces 0°
  const PHASE_OFFSET = Math.PI + Math.atan2(RIGHT, FRONT);

  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  // Collect pairs
  type SwingPair = {
    lark: ProtoDancerId;
    robin: ProtoDancerId;
    cx: number;
    cy: number;
    f0: number; // lark's initial facing in radians
    omega: number; // angular velocity in radians per beat
    endFacingRad: number;
    phase2Start: number; // beat offset when lark has 90° left
    phase2Duration: number; // duration of phase 2 in beats
  };

  const pairs: SwingPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    if (processed.has(id)) continue;

    const targetId = resolveRelationship(instr.relationship, id, prev.dancers);
    const { proto: targetProto, offset } = parseDancerId(targetId);

    if (offset !== 0) {
      throw new Error(`Swing: relationship '${instr.relationship}' for ${id} resolves to a different hands-four`);
    }
    if (!scope.has(targetProto)) {
      throw new Error(`Swing: relationship '${instr.relationship}' for ${id} resolves to ${targetProto} which is not in scope`);
    }

    // Check reciprocity
    const reverseId = resolveRelationship(instr.relationship, targetProto, prev.dancers);
    const { proto: reverseProto, offset: reverseOffset } = parseDancerId(reverseId);
    if (reverseProto !== id || reverseOffset !== 0) {
      throw new Error(`Swing: relationship '${instr.relationship}' is not reciprocal between ${id} and ${targetProto}`);
    }

    // Check opposite roles
    if (isLark(id) === isLark(targetProto)) {
      throw new Error(`Swing: ${id} and ${targetProto} have the same role`);
    }

    const lark = isLark(id) ? id : targetProto;
    const robin = isLark(id) ? targetProto : id;

    processed.add(lark);
    processed.add(robin);

    // Compute CoM
    const larkState = prev.dancers[lark];
    const robinState = prev.dancers[robin];
    const cx = (larkState.x + robinState.x) / 2;
    const cy = (larkState.y + robinState.y) / 2;

    // Compute initial facing of lark from angle of CoM→lark
    const larkDx = larkState.x - cx;
    const larkDy = larkState.y - cy;
    const thetaLark = Math.atan2(larkDx, larkDy);
    const f0 = thetaLark - PHASE_OFFSET;

    // Resolve end facing for the lark
    const endFacingDeg = resolveFacing(instr.endFacing, larkState, lark, prev.dancers);
    const endFacingRad = endFacingDeg * Math.PI / 180;

    // Compute total rotation: closest to baseRotation that ends at endFacing
    const baseRotation = (Math.PI / 2) * instr.beats; // ~90° per beat
    const needed = endFacingRad - f0;
    const n = Math.round((baseRotation - needed) / (2 * Math.PI));
    const totalRotation = needed + n * 2 * Math.PI;
    const omega = totalRotation / instr.beats;

    // Phase 2 starts when the lark has 90° (π/2) of rotation left
    const phase2Duration = (Math.PI / 2) / omega;
    const phase2Start = instr.beats - phase2Duration;

    pairs.push({ lark, robin, cx, cy, f0, omega, endFacingRad, phase2Start, phase2Duration });
  }

  // Drop all hands involving swing participants, then take lark-right ↔ robin-left
  const swingHands = prev.hands.filter(h =>
    !processed.has(parseDancerId(h.a).proto) && !processed.has(parseDancerId(h.b).proto)
  );
  for (const { lark, robin } of pairs) {
    swingHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'left' });
  }

  const result: Keyframe[] = [];

  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const elapsed = t * instr.beats;

    const dancers = copyDancers(prev.dancers);

    for (const pair of pairs) {
      const { lark, robin, cx, cy, f0, omega, endFacingRad, phase2Start, phase2Duration } = pair;

      const larkFacingRad = f0 + omega * elapsed;
      const larkFacingDeg = ((larkFacingRad * 180 / Math.PI) % 360 + 360) % 360;

      if (elapsed <= phase2Start) {
        // Phase 1: regular swing orbit
        dancers[lark].x = cx - FRONT * Math.sin(larkFacingRad) - RIGHT * Math.cos(larkFacingRad);
        dancers[lark].y = cy - FRONT * Math.cos(larkFacingRad) + RIGHT * Math.sin(larkFacingRad);
        dancers[lark].facing = larkFacingDeg;

        // Robin faces opposite
        const robinFacingRad = larkFacingRad + Math.PI;
        const robinFacingDeg = ((robinFacingRad * 180 / Math.PI) % 360 + 360) % 360;
        dancers[robin].x = cx + FRONT * Math.sin(larkFacingRad) + RIGHT * Math.cos(larkFacingRad);
        dancers[robin].y = cy + FRONT * Math.cos(larkFacingRad) - RIGHT * Math.sin(larkFacingRad);
        dancers[robin].facing = robinFacingDeg;
      } else {
        // Phase 2: lark has 90° of rotation left
        const tLocal = (elapsed - phase2Start) / phase2Duration; // 0 to 1

        // Lark position: interpolate from phase1 end to final position
        const fP1End = f0 + omega * phase2Start;
        const larkP1EndX = cx - FRONT * Math.sin(fP1End) - RIGHT * Math.cos(fP1End);
        const larkP1EndY = cy - FRONT * Math.cos(fP1End) + RIGHT * Math.sin(fP1End);

        // Final position: CoM is 0.5m to lark's right
        const larkFinalX = cx - 0.5 * Math.cos(endFacingRad);
        const larkFinalY = cy + 0.5 * Math.sin(endFacingRad);

        dancers[lark].x = larkP1EndX + (larkFinalX - larkP1EndX) * tLocal;
        dancers[lark].y = larkP1EndY + (larkFinalY - larkP1EndY) * tLocal;
        dancers[lark].facing = larkFacingDeg;

        // Robin facing: extra 180° CW over phase 2
        // At tLocal=0: lark+180°, at tLocal=1: lark+360°=lark
        const robinFacingRad = larkFacingRad + Math.PI * (1 + tLocal);
        const robinFacingDeg = ((robinFacingRad * 180 / Math.PI) % 360 + 360) % 360;
        dancers[robin].facing = robinFacingDeg;

        // Robin position: in lark's reference frame
        // Starts at (0.3 front, 0.2 right), ends at (0.0 front, 1.0 right)
        const robinFront = 0.3 * (1 - tLocal);
        const robinRight = 0.2 + 0.8 * tLocal;

        // Convert from lark's reference frame to global
        dancers[robin].x = dancers[lark].x + robinFront * Math.sin(larkFacingRad) + robinRight * Math.cos(larkFacingRad);
        dancers[robin].y = dancers[lark].y + robinFront * Math.cos(larkFacingRad) - robinRight * Math.sin(larkFacingRad);
      }
    }

    // Drop swing hands on the final frame
    const hands = i === nFrames
      ? swingHands.filter(h => !processed.has(parseDancerId(h.a).proto) || !processed.has(parseDancerId(h.b).proto))
      : swingHands;
    result.push({ beat, dancers, hands });
  }

  return result;
}

function generateBoxTheGnat(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'box_the_gnat' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  // Collect pairs with validation
  type GnatPair = {
    lark: ProtoDancerId;
    robin: ProtoDancerId;
    cx: number; cy: number;
    majorX: number; majorY: number;  // unit vector from center toward lark start
    minorX: number; minorY: number;  // unit vector perpendicular (toward lark's right)
    semiMajor: number;
    semiMinor: number;
    larkStartFacing: number;  // radians, facing toward robin
    robinStartFacing: number; // radians, facing toward lark
  };

  const pairs: GnatPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    if (processed.has(id)) continue;

    const targetId = resolveRelationship(instr.relationship, id, prev.dancers);
    const { proto: targetProto, offset } = parseDancerId(targetId);

    if (offset !== 0) {
      throw new Error(`Box the gnat: relationship '${instr.relationship}' for ${id} resolves to a different hands-four`);
    }
    if (!scope.has(targetProto)) {
      throw new Error(`Box the gnat: relationship '${instr.relationship}' for ${id} resolves to ${targetProto} which is not in scope`);
    }

    // Check reciprocity
    const reverseId = resolveRelationship(instr.relationship, targetProto, prev.dancers);
    const { proto: reverseProto, offset: reverseOffset } = parseDancerId(reverseId);
    if (reverseProto !== id || reverseOffset !== 0) {
      throw new Error(`Box the gnat: relationship '${instr.relationship}' is not reciprocal between ${id} and ${targetProto}`);
    }

    // Check opposite roles
    if (isLark(id) === isLark(targetProto)) {
      throw new Error(`Box the gnat: ${id} and ${targetProto} have the same role`);
    }

    const lark = isLark(id) ? id : targetProto;
    const robin = isLark(id) ? targetProto : id;
    processed.add(lark);
    processed.add(robin);

    const larkState = prev.dancers[lark];
    const robinState = prev.dancers[robin];
    const cx = (larkState.x + robinState.x) / 2;
    const cy = (larkState.y + robinState.y) / 2;
    const dx = larkState.x - cx;
    const dy = larkState.y - cy;
    const dist = Math.hypot(dx, dy);
    const majorX = dx / dist;
    const majorY = dy / dist;
    // Minor axis: 90° CW from major axis (toward lark's right when facing robin)
    const minorX = majorY;
    const minorY = -majorX;

    // Lark faces robin, robin faces lark
    const larkStartFacing = Math.atan2(robinState.x - larkState.x, robinState.y - larkState.y);
    const robinStartFacing = Math.atan2(larkState.x - robinState.x, larkState.y - robinState.y);

    pairs.push({
      lark, robin, cx, cy, majorX, majorY, minorX, minorY,
      semiMajor: dist,
      semiMinor: dist / 2,
      larkStartFacing, robinStartFacing,
    });
  }

  // Build hand connections: right hand to right hand
  let gnatHands = [...prev.hands];
  for (const { lark, robin } of pairs) {
    gnatHands.push({ a: makeDancerId(lark, 0), ha: 'right', b: makeDancerId(robin, 0), hb: 'right' });
  }

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const theta = Math.PI * tEased;

    const dancers = copyDancers(prev.dancers);
    for (const p of pairs) {
      // Lark traces top half of ellipse (θ from 0 to π)
      dancers[p.lark].x = p.cx + p.semiMajor * Math.cos(theta) * p.majorX + p.semiMinor * Math.sin(theta) * p.minorX;
      dancers[p.lark].y = p.cy + p.semiMajor * Math.cos(theta) * p.majorY + p.semiMinor * Math.sin(theta) * p.minorY;
      // Robin traces bottom half (opposite side)
      dancers[p.robin].x = p.cx - p.semiMajor * Math.cos(theta) * p.majorX - p.semiMinor * Math.sin(theta) * p.minorX;
      dancers[p.robin].y = p.cy - p.semiMajor * Math.cos(theta) * p.majorY - p.semiMinor * Math.sin(theta) * p.minorY;

      // Lark turns CW 180°, robin turns CCW 180°
      const larkFacing = p.larkStartFacing + Math.PI * tEased;
      const robinFacing = p.robinStartFacing - Math.PI * tEased;
      dancers[p.lark].facing = ((larkFacing * 180 / Math.PI) % 360 + 360) % 360;
      dancers[p.robin].facing = ((robinFacing * 180 / Math.PI) % 360 + 360) % 360;
    }

    // Drop hands on the final frame
    const hands = i === nFrames ? prev.hands : gnatHands;
    result.push({ beat, dancers, hands });
  }

  return result;
}

function generateGiveAndTakeIntoSwing(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const walkBeats = 1;
  const swingBeats = instr.beats - walkBeats;

  // Collect pairs with validation
  type GTPair = {
    drawer: ProtoDancerId;
    drawee: ProtoDancerId;
    lark: ProtoDancerId;
    robin: ProtoDancerId;
  };

  const pairs: GTPair[] = [];
  const processed = new Set<ProtoDancerId>();

  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    if (processed.has(id)) continue;

    const targetId = resolveRelationship(instr.relationship, id, prev.dancers);
    const { proto: targetProto, offset } = parseDancerId(targetId);

    if (offset !== 0) {
      throw new Error(`Give & take into swing: relationship '${instr.relationship}' for ${id} resolves to a different hands-four`);
    }
    if (!scope.has(targetProto)) {
      throw new Error(`Give & take into swing: relationship '${instr.relationship}' for ${id} resolves to ${targetProto} which is not in scope`);
    }

    // Check reciprocity
    const reverseId = resolveRelationship(instr.relationship, targetProto, prev.dancers);
    const { proto: reverseProto, offset: reverseOffset } = parseDancerId(reverseId);
    if (reverseProto !== id || reverseOffset !== 0) {
      throw new Error(`Give & take into swing: relationship '${instr.relationship}' is not reciprocal between ${id} and ${targetProto}`);
    }

    // Check opposite roles
    if (isLark(id) === isLark(targetProto)) {
      throw new Error(`Give & take into swing: ${id} and ${targetProto} have the same role`);
    }

    // Check opposite sides
    const aState = prev.dancers[id];
    const bState = prev.dancers[targetProto];
    if (Math.sign(aState.x) === Math.sign(bState.x) && Math.abs(aState.x) > 1e-6 && Math.abs(bState.x) > 1e-6) {
      throw new Error(`Give & take into swing: ${id} and ${targetProto} are on the same side of the set`);
    }

    const lark = isLark(id) ? id : targetProto;
    const robin = isLark(id) ? targetProto : id;
    const drawer = instr.role === 'lark' ? lark : robin;
    const drawee = instr.role === 'lark' ? robin : lark;

    processed.add(lark);
    processed.add(robin);
    pairs.push({ drawer, drawee, lark, robin });
  }

  // Phase 1: drawee walks halfway to drawer (1 beat)
  // Face each other immediately
  const walkStartDancers = copyDancers(prev.dancers);
  for (const { drawer, drawee } of pairs) {
    const drawerState = prev.dancers[drawer];
    const draweeState = prev.dancers[drawee];
    walkStartDancers[drawer].facing = ((Math.atan2(draweeState.x - drawerState.x, draweeState.y - drawerState.y) * 180 / Math.PI) % 360 + 360) % 360;
    walkStartDancers[drawee].facing = ((Math.atan2(drawerState.x - draweeState.x, drawerState.y - draweeState.y) * 180 / Math.PI) % 360 + 360) % 360;
  }
  const walkStart: Keyframe = { beat: prev.beat, dancers: walkStartDancers, hands: prev.hands };

  const walkNFrames = Math.max(1, Math.round(walkBeats / 0.25));
  const walkFrames: Keyframe[] = [];
  for (let i = 1; i <= walkNFrames; i++) {
    const t = i / walkNFrames;
    const beat = prev.beat + t * walkBeats;
    const tEased = easeInOut(t);
    const dancers = copyDancers(walkStart.dancers);
    for (const { drawer, drawee } of pairs) {
      const draweeStart = prev.dancers[drawee];
      const drawerPos = prev.dancers[drawer];
      const halfwayX = (drawerPos.x + draweeStart.x) / 2;
      const halfwayY = (drawerPos.y + draweeStart.y) / 2;
      dancers[drawee].x = draweeStart.x + (halfwayX - draweeStart.x) * tEased;
      dancers[drawee].y = draweeStart.y + (halfwayY - draweeStart.y) * tEased;
      // Drawee keeps facing drawer during walk
      dancers[drawee].facing = walkStart.dancers[drawee].facing;
      // Drawer stays put
      dancers[drawer].x = drawerPos.x;
      dancers[drawer].y = drawerPos.y;
      dancers[drawer].facing = walkStart.dancers[drawer].facing;
    }
    walkFrames.push({ beat, dancers, hands: prev.hands });
  }

  // Phase 2: swing from the meeting point, with CoM drift
  const afterWalk = walkFrames.length > 0 ? walkFrames[walkFrames.length - 1] : walkStart;

  // Compute the swing as if it started from the afterWalk state
  // Then shift each frame's CoM to drift toward the final position
  const swingInstr: Extract<AtomicInstruction, { type: 'swing' }> = {
    id: instr.id,
    beats: swingBeats,
    type: 'swing',
    relationship: instr.relationship,
    endFacing: instr.endFacing,
  };
  const rawSwingFrames = generateSwing(afterWalk, swingInstr, scope);

  // For each pair, compute the final CoM and drift
  const driftData: { lark: ProtoDancerId; robin: ProtoDancerId; finalCx: number; finalCy: number; startCx: number; startCy: number }[] = [];
  for (const { drawer, lark, robin } of pairs) {
    const drawerState = prev.dancers[drawer];
    const drawerFacing = walkStart.dancers[drawer].facing * Math.PI / 180;
    // "Right" if drawer is lark, "left" if drawer is robin
    const sign = isLark(drawer) ? 1 : -1;
    // CW rotation of facing vector gives "right": (sin(f), cos(f)) → (cos(f), -sin(f))
    const rightX = sign * Math.cos(drawerFacing);
    const rightY = sign * -Math.sin(drawerFacing);
    const finalCx = drawerState.x + 0.5 * rightX;
    const finalCy = drawerState.y + 0.5 * rightY;

    // Start CoM is from the afterWalk positions
    const startCx = (afterWalk.dancers[lark].x + afterWalk.dancers[robin].x) / 2;
    const startCy = (afterWalk.dancers[lark].y + afterWalk.dancers[robin].y) / 2;

    driftData.push({ lark, robin, finalCx, finalCy, startCx, startCy });
  }

  // Shift swing frames so CoM drifts from startCoM to finalCoM
  const shiftedSwingFrames: Keyframe[] = rawSwingFrames.map((kf, idx) => {
    const t = (idx + 1) / rawSwingFrames.length;
    const tEased = easeInOut(t);
    const dancers = copyDancers(kf.dancers);
    for (const { lark, robin, finalCx, finalCy, startCx, startCy } of driftData) {
      const currentCx = (kf.dancers[lark].x + kf.dancers[robin].x) / 2;
      const currentCy = (kf.dancers[lark].y + kf.dancers[robin].y) / 2;
      const targetCx = startCx + (finalCx - startCx) * tEased;
      const targetCy = startCy + (finalCy - startCy) * tEased;
      const shiftX = targetCx - currentCx;
      const shiftY = targetCy - currentCy;
      dancers[lark].x += shiftX;
      dancers[lark].y += shiftY;
      dancers[robin].x += shiftX;
      dancers[robin].y += shiftY;
    }
    return { ...kf, dancers };
  });

  return [...walkFrames, ...shiftedSwingFrames];
}

// --- Process a list of atomic instructions with a given scope ---

function processAtomicInstruction(prev: Keyframe, instr: AtomicInstruction, scope: Set<ProtoDancerId>): Keyframe[] {
  switch (instr.type) {
    case 'take_hands':  return generateTakeHands(prev, instr, scope);
    case 'drop_hands':  return generateDropHands(prev, instr, scope);
    case 'allemande':   return generateAllemande(prev, instr, scope);
    case 'do_si_do':    return generateDoSiDo(prev, instr, scope);
    case 'circle':      return generateCircle(prev, instr, scope);
    case 'pull_by':     return generatePullBy(prev, instr, scope);
    case 'turn':        return generateTurn(prev, instr, scope);
    case 'step':        return generateStep(prev, instr, scope);
    case 'balance':     return generateBalance(prev, instr, scope);
    case 'swing':       return generateSwing(prev, instr, scope);
    case 'box_the_gnat':             return generateBoxTheGnat(prev, instr, scope);
    case 'give_and_take_into_swing': return generateGiveAndTakeIntoSwing(prev, instr, scope);
  }
}

function processInstructions(prev: Keyframe, instructions: AtomicInstruction[], scope: Set<ProtoDancerId>): Keyframe[] {
  const result: Keyframe[] = [];
  let current = prev;
  for (const instr of instructions) {
    const newFrames = processAtomicInstruction(current, instr, scope);
    result.push(...newFrames);
    if (newFrames.length > 0) {
      current = newFrames[newFrames.length - 1];
    }
  }
  return result;
}

// --- Split generation ---

/** Find the last keyframe at or before the given beat. */
function sampleAtBeat(timeline: Keyframe[], beat: number): Keyframe | null {
  let best: Keyframe | null = null;
  for (const kf of timeline) {
    if (kf.beat <= beat + 1e-9) {
      best = kf;
    } else {
      break;
    }
  }
  return best;
}

function generateSplit(prev: Keyframe, instr: Extract<Instruction, { type: 'split' }>): Keyframe[] {
  const [groupA, groupB] = SPLIT_GROUPS[instr.by];

  const timelineA = processInstructions(prev, instr.listA, groupA);
  const timelineB = processInstructions(prev, instr.listB, groupB);

  if (timelineA.length === 0 && timelineB.length === 0) {
    return [];
  }

  // Collect all unique beat values
  const beatSet = new Set<number>();
  for (const kf of timelineA) beatSet.add(kf.beat);
  for (const kf of timelineB) beatSet.add(kf.beat);
  const sortedBeats = [...beatSet].sort((a, b) => a - b);

  const merged: Keyframe[] = [];
  for (const beat of sortedBeats) {
    const kfA = sampleAtBeat(timelineA, beat);
    const kfB = sampleAtBeat(timelineB, beat);

    const dancers = buildDancerRecord(id => {
      const src = groupA.has(id)
        ? (kfA ? kfA.dancers[id] : prev.dancers[id])
        : (kfB ? kfB.dancers[id] : prev.dancers[id]);
      return { x: src.x, y: src.y, facing: src.facing };
    });

    // Merge hands: combine from both timelines, dedup by (a,b) pair
    const handsA = kfA ? kfA.hands : prev.hands;
    const handsB = kfB ? kfB.hands : prev.hands;
    const handMap = new Map<string, HandConnection>();
    for (const h of handsA) {
      const key = h.a < h.b ? `${h.a}:${h.b}` : `${h.b}:${h.a}`;
      handMap.set(key, h);
    }
    for (const h of handsB) {
      const key = h.a < h.b ? `${h.a}:${h.b}` : `${h.b}:${h.a}`;
      handMap.set(key, h);
    }

    merged.push({ beat, dancers, hands: [...handMap.values()] });
  }

  return merged;
}

// --- Top-level generator ---

function instructionDuration(instr: Instruction): number {
  if (instr.type === 'split')
    return Math.max(
      instr.listA.reduce((s, i) => s + i.beats, 0),
      instr.listB.reduce((s, i) => s + i.beats, 0)
    );
  if (instr.type === 'group')
    return instr.instructions.reduce((s, i) => s + instructionDuration(i), 0);
  return instr.beats;
}

/** Flatten instructions into leaf-level beat ranges (recurses into groups). */
function buildBeatRanges(instructions: Instruction[]): { id: InstructionId; start: number; end: number }[] {
  const ranges: { id: InstructionId; start: number; end: number }[] = [];
  let cumBeat = 0;
  function walk(instrs: Instruction[]) {
    for (const instr of instrs) {
      if (instr.type === 'group') {
        walk(instr.instructions);
      } else {
        const dur = instructionDuration(instr);
        ranges.push({ id: instr.id, start: cumBeat, end: cumBeat + dur });
        cumBeat += dur;
      }
    }
  }
  walk(instructions);
  return ranges;
}

export function validateHandDistances(
  instructions: Instruction[],
  keyframes: Keyframe[],
  maxDistance = 1.2
): Map<InstructionId, string> {
  const ranges = buildBeatRanges(instructions);

  const warnings = new Map<InstructionId, string>();

  for (const kf of keyframes) {
    for (const hand of kf.hands) {
      const posA = dancerPosition(hand.a, kf.dancers);
      const posB = dancerPosition(hand.b, kf.dancers);
      const dist = Math.hypot(posA.x - posB.x, posA.y - posB.y);
      if (dist > maxDistance) {
        // Find the instruction owning this beat
        for (const r of ranges) {
          if (kf.beat >= r.start - 1e-9 && kf.beat <= r.end + 1e-9) {
            if (!warnings.has(r.id)) {
              warnings.set(r.id, `Hands too far apart (${dist.toFixed(2)}m)`);
            }
            break;
          }
        }
      }
    }
  }

  return warnings;
}

export function validateProgression(
  keyframes: Keyframe[],
  initFormation: InitFormation,
  progression: number,
): string | null {
  if (keyframes.length === 0) return null;
  const init = initialKeyframe(initFormation);
  const final = keyframes[keyframes.length - 1];
  const expectedDy = 2 * progression;
  const problems: string[] = [];
  for (const id of PROTO_DANCER_IDS) {
    const sign = UPS.has(id) ? 1 : -1;
    const expectedX = init.dancers[id].x;
    const expectedY = init.dancers[id].y + sign * expectedDy;
    const dx = final.dancers[id].x - expectedX;
    const dy = final.dancers[id].y - expectedY;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.01) {
      problems.push(`${id} is ${dist.toFixed(2)}m off`);
    }
  }
  if (problems.length === 0) return null;
  return `Dancers don't end at expected progression positions: ${problems.join('; ')}`;
}

function processTopLevelInstruction(prev: Keyframe, instr: Instruction): Keyframe[] {
  if (instr.type === 'split') {
    return generateSplit(prev, instr);
  } else if (instr.type === 'group') {
    const result: Keyframe[] = [];
    let current = prev;
    for (const child of instr.instructions) {
      const childFrames = processTopLevelInstruction(current, child);
      result.push(...childFrames);
      if (childFrames.length > 0) {
        current = childFrames[childFrames.length - 1];
      }
    }
    return result;
  } else {
    return processAtomicInstruction(prev, instr, ALL_DANCERS);
  }
}

export interface GenerateError {
  instructionId: InstructionId;
  message: string;
}

export interface GenerateResult {
  keyframes: Keyframe[];
  error: GenerateError | null;
}

export function generateAllKeyframes(instructions: Instruction[], initFormation?: InitFormation): GenerateResult {
  const keyframes: Keyframe[] = [initialKeyframe(initFormation)];

  for (const instr of instructions) {
    const prev = keyframes[keyframes.length - 1];
    try {
      const newFrames = processTopLevelInstruction(prev, instr);
      keyframes.push(...newFrames);
    } catch (e) {
      return {
        keyframes,
        error: { instructionId: instr.id, message: e instanceof Error ? e.message : String(e) },
      };
    }
  }

  return { keyframes, error: null };
}
