import type { Instruction, AtomicInstruction, Keyframe, Relationship, RelativeDirection, DancerState, DancerHands, ProtoDancerId, DancerId } from './types';
import { makeDancerId, parseDancerId, dancerPosition, AtomicInstructionSchema } from './types';

const PROTO_DANCER_IDS: readonly ProtoDancerId[] = ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const;
const ALL_DANCERS = new Set<ProtoDancerId>(PROTO_DANCER_IDS);

const UPS = new Set<ProtoDancerId>(['up_lark', 'up_robin']);

const STATIC_RELATIONSHIPS: Partial<Record<Relationship, Record<ProtoDancerId, ProtoDancerId>>> = {
  partner:  { up_lark: 'up_robin', up_robin: 'up_lark', down_lark: 'down_robin', down_robin: 'down_lark' },
  neighbor: { up_lark: 'down_robin', up_robin: 'down_lark', down_lark: 'up_robin', down_robin: 'up_lark' },
  opposite: { up_lark: 'down_lark', up_robin: 'down_robin', down_lark: 'up_lark', down_robin: 'up_robin' },
};

const SPLIT_GROUPS: Record<'role' | 'position', [Set<ProtoDancerId>, Set<ProtoDancerId>]> = {
  role:     [new Set(['up_lark', 'down_lark']), new Set(['up_robin', 'down_robin'])],
  position: [new Set(['up_lark', 'up_robin']), new Set(['down_lark', 'down_robin'])],
};

function initialKeyframe(): Keyframe {
  return {
    beat: 0,
    dancers: {
      up_lark:    { x: -0.5, y: -0.5, facing: 0 },
      up_robin:   { x:  0.5, y: -0.5, facing: 0 },
      down_lark:  { x:  0.5, y:  0.5, facing: 180 },
      down_robin: { x: -0.5, y:  0.5, facing: 180 },
    },
    hands: { up_lark: {}, up_robin: {}, down_lark: {}, down_robin: {} },
  };
}

function copyDancers(dancers: Record<ProtoDancerId, DancerState>): Record<ProtoDancerId, DancerState> {
  const result = {} as Record<ProtoDancerId, DancerState>;
  for (const id of PROTO_DANCER_IDS) {
    const d = dancers[id];
    result[id] = { x: d.x, y: d.y, facing: d.facing };
  }
  return result;
}

function copyHands(hands: Record<ProtoDancerId, DancerHands>): Record<ProtoDancerId, DancerHands> {
  const result = {} as Record<ProtoDancerId, DancerHands>;
  for (const id of PROTO_DANCER_IDS) {
    const h = hands[id];
    result[id] = {};
    if (h.left) result[id].left = [h.left[0], h.left[1]];
    if (h.right) result[id].right = [h.right[0], h.right[1]];
  }
  return result;
}

function makeHands(
  prev: Record<ProtoDancerId, DancerHands>,
  connections: Array<{proto: ProtoDancerId, hand: 'left'|'right', target: DancerId, targetHand: 'left'|'right'}>
): Record<ProtoDancerId, DancerHands> {
  const result = copyHands(prev);
  for (const c of connections) {
    const { proto: targetProto, offset } = parseDancerId(c.target);
    // Skip if either slot is already occupied to maintain symmetry
    if (result[c.proto][c.hand] || result[targetProto][c.targetHand]) continue;
    result[c.proto][c.hand] = [c.target, c.targetHand];
    result[targetProto][c.targetHand] = [makeDancerId(c.proto, -offset), c.hand];
  }
  return result;
}

/** Resolve a relationship from a specific dancer's perspective.
 *  Returns the DancerId of the target, which may be in an adjacent hands-four. */
function resolveRelationship(relationship: Relationship, id: ProtoDancerId, dancers: Record<ProtoDancerId, DancerState>): DancerId {
  const staticMap = STATIC_RELATIONSHIPS[relationship];
  if (staticMap) {
    return makeDancerId(staticMap[id], 0);
  }
  // Spatial: on_right (+90°), on_left (-90°), in_front (0°)
  const relAngleDeg = relationship === 'on_right' ? 90 : relationship === 'on_left' ? -90 : 0;
  const d = dancers[id];
  const targetRad = (d.facing + relAngleDeg) * Math.PI / 180;
  const ux = Math.sin(targetRad);
  const uy = Math.cos(targetRad);

  // 15 candidates: 3 other protos × 5 nearest concrete dancers each
  let bestScore = Infinity;
  let bestCosTheta = -Infinity;
  let bestTarget: DancerId = makeDancerId(id, 0); // fallback
  for (const otherId of PROTO_DANCER_IDS) {
    if (otherId === id) continue;
    const baseOffset = Math.round((d.y - dancers[otherId].y) / 2);
    for (let delta = -2; delta <= 2; delta++) {
      const offset = baseOffset + delta;
      const targetId = makeDancerId(otherId, offset);
      const pos = dancerPosition(targetId, dancers);
      const dx = pos.x - d.x;
      const dy = pos.y - d.y;
      const r2 = dx * dx + dy * dy;
      if (r2 < 1e-12) continue;
      const r = Math.sqrt(r2);
      const cosTheta = (ux * dx + uy * dy) / r;
      if (cosTheta < 0) continue;
      const theta = Math.acos(Math.min(cosTheta, 1));
      if (Math.cos(1.4 * theta) < 0) continue;
      const score = r2 / Math.cos(1.5 * theta);
      if (score < bestScore || (score === bestScore && cosTheta > bestCosTheta)) {
        bestScore = score;
        bestCosTheta = cosTheta;
        bestTarget = targetId;
      }
    }
  }
  return bestTarget;
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

function generateTakeHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'take_hands' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const connections: Array<{proto: ProtoDancerId, hand: 'left'|'right', target: DancerId, targetHand: 'left'|'right'}> = [];
  const seen = new Set<string>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!seen.has(key)) {
      seen.add(key);
      connections.push({ proto: id, hand: instr.hand, target, targetHand: instr.hand });
    }
  }
  return [{
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: makeHands(prev.hands, connections),
  }];
}

function generateDropHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'drop_hands' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  const target = instr.target;
  const newHands = copyHands(prev.hands);

  if (target === 'both') {
    // Drop all hand entries for scoped dancers, and remove reverse entries pointing at them
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      // Remove entries pointing at this dancer from others
      for (const hand of ['left', 'right'] as const) {
        const held = newHands[id][hand];
        if (held) {
          const { proto: targetProto } = parseDancerId(held[0]);
          if (newHands[targetProto][held[1]]?.[0] !== undefined) {
            delete newHands[targetProto][held[1]];
          }
        }
      }
      newHands[id] = {};
    }
  } else if (target === 'left' || target === 'right') {
    // Drop the specific hand for scoped dancers, and the reverse entry
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const held = newHands[id][target];
      if (held) {
        const { proto: targetProto } = parseDancerId(held[0]);
        delete newHands[targetProto][held[1]];
        delete newHands[id][target];
      }
    }
  } else {
    // It's a Relationship — drop hands between those pairs
    for (const id of PROTO_DANCER_IDS) {
      if (!scope.has(id)) continue;
      const resolved = resolveRelationship(target, id, prev.dancers);
      const { proto: targetProto } = parseDancerId(resolved);
      // Remove any hand entries connecting id to targetProto
      for (const hand of ['left', 'right'] as const) {
        const held = newHands[id][hand];
        if (held && parseDancerId(held[0]).proto === targetProto) {
          delete newHands[targetProto][held[1]];
          delete newHands[id][hand];
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

function generateAllemande(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  // right = CW, left = CCW
  const totalAngleDeg = instr.rotations * 360 * (instr.handedness === 'right' ? 1 : -1);
  const totalAngleRad = totalAngleDeg * Math.PI / 180;
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));
  // Shoulder offset: right hand → face 90° CCW from partner; left → 90° CW
  const shoulderOffset = instr.handedness === 'right' ? -90 : 90;

  // Build hand connections from per-dancer resolution
  const connections: Array<{proto: ProtoDancerId, hand: 'left'|'right', target: DancerId, targetHand: 'left'|'right'}> = [];
  const handsSeen = new Set<string>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!handsSeen.has(key)) {
      handsSeen.add(key);
      connections.push({ proto: id, hand: instr.handedness, target, targetHand: instr.handedness });
    }
  }
  const hands = makeHands(prev.hands, connections);

  // Build orbit data from the actual hand-connection pairs so both dancers
  // in a pair share the same center (fixes non-reciprocal resolutions).
  const orbitData: { protoId: ProtoDancerId; cx: number; cy: number; startAngle: number; radius: number }[] = [];
  const orbited = new Set<ProtoDancerId>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id) || orbited.has(id)) continue;
    const hold = hands[id][instr.handedness];
    if (!hold) continue;
    const [targetDancerId] = hold;
    const { proto: targetProto, offset: targetOffset } = parseDancerId(targetDancerId);

    const da = prev.dancers[id];
    const db = dancerPosition(targetDancerId, prev.dancers);
    const cx = (da.x + db.x) / 2;
    const cy = (da.y + db.y) / 2;
    const radius = Math.hypot(da.x - cx, da.y - cy);

    orbitData.push({
      protoId: id, cx, cy,
      startAngle: Math.atan2(da.x - cx, da.y - cy),
      radius,
    });
    orbited.add(id);

    if (scope.has(targetProto) && !orbited.has(targetProto)) {
      // Partner's proto-dancer center is offset-adjusted so that the
      // physical pair (id, targetDancerId) orbits a shared center.
      const adjCy = cy - targetOffset * 2;
      orbitData.push({
        protoId: targetProto, cx, cy: adjCy,
        startAngle: Math.atan2(prev.dancers[targetProto].x - cx, prev.dancers[targetProto].y - adjCy),
        radius,
      });
      orbited.add(targetProto);
    }
  }
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
  const stepOut = AtomicInstructionSchema.parse({ id: 0, beats: halfBeats, type: 'step', direction: instr.direction, distance: instr.distance });
  const outFrames = generateStep(prev, stepOut as Extract<AtomicInstruction, { type: 'step' }>, scope);
  const lastOut = outFrames.length > 0 ? outFrames[outFrames.length - 1] : prev;
  const stepBack = AtomicInstructionSchema.parse({ id: 0, beats: halfBeats, type: 'step', direction: instr.direction, distance: -instr.distance });
  const backFrames = generateStep(lastOut, stepBack as Extract<AtomicInstruction, { type: 'step' }>, scope);
  return [...outFrames, ...backFrames];
}

function generateDoSiDo(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'do_si_do' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  // Like allemande but dancers maintain original facing and no hand connections
  const totalAngleRad = instr.rotations * 2 * Math.PI; // always CW (pass right shoulders)
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const orbitData: { protoId: ProtoDancerId; cx: number; cy: number; startAngle: number; radius: number; originalFacing: number }[] = [];
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
      radius: Math.hypot(da.x - cx, da.y - cy),
      originalFacing: da.facing,
    });
  }

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
      dancers[od.protoId].facing = od.originalFacing; // maintain original facing
    }
    result.push({ beat, dancers, hands: prev.hands });
  }
  return result;
}

function generateCircle(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'circle' }>, scope: Set<ProtoDancerId>): Keyframe[] {
  // All scoped dancers orbit around their common center
  // Left = CCW (negative angle), Right = CW (positive angle)
  const sign = instr.direction === 'right' ? 1 : -1;
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

  // Build ring hand connections: sort dancers by their starting angle, connect adjacent pairs
  const sorted = [...orbitData].sort((a, b) => a.startAngle - b.startAngle);
  const ringConnections: Array<{proto: ProtoDancerId, hand: 'left'|'right', target: DancerId, targetHand: 'left'|'right'}> = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const a = makeDancerId(curr.protoId, 0);
    const b = makeDancerId(next.protoId, 0);
    const [loProto, loHand, hiId, hiHand]: [ProtoDancerId, 'left'|'right', DancerId, 'left'|'right'] =
      a < b ? [curr.protoId, 'left', b, 'right'] : [next.protoId, 'right', a, 'left'];
    ringConnections.push({ proto: loProto, hand: loHand, target: hiId, targetHand: hiHand });
  }
  const hands = makeHands(prev.hands, ringConnections);

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
  const lateralSign = instr.hand === 'right' ? 1 : -1;
  const halfwayBeat = prev.beat + instr.beats / 2;

  // Build swap pairs, perpendicular offsets, and hand connections
  const swapData: { protoId: ProtoDancerId; startX: number; startY: number;
    targetX: number; targetY: number; perpX: number; perpY: number; facingDeg: number }[] = [];
  const connections: Array<{proto: ProtoDancerId, hand: 'left'|'right', target: DancerId, targetHand: 'left'|'right'}> = [];
  const seen = new Set<string>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    const da = prev.dancers[id];
    const targetPos = dancerPosition(target, prev.dancers);
    const dx = targetPos.x - da.x;
    const dy = targetPos.y - da.y;
    const dist = Math.hypot(dx, dy);
    // Perpendicular: CCW 90° rotation of direction, scaled by lateralSign
    const perpX = dist > 0 ? (-dy / dist) * lateralSign : 0;
    const perpY = dist > 0 ? (dx / dist) * lateralSign : 0;
    // Facing: toward partner throughout
    const facingDeg = ((Math.atan2(dx, dy) * 180 / Math.PI) % 360 + 360) % 360;
    swapData.push({ protoId: id, startX: da.x, startY: da.y,
      targetX: targetPos.x, targetY: targetPos.y, perpX, perpY, facingDeg });
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!seen.has(key)) {
      seen.add(key);
      connections.push({ proto: id, hand: instr.hand, target, targetHand: instr.hand });
    }
  }
  const handsFirst = makeHands(prev.hands, connections);
  const handsSecond = copyHands(prev.hands);

  const result: Keyframe[] = [];
  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const lateral = Math.sin(Math.PI * t) * 0.25;
    const dancers = copyDancers(prev.dancers);
    for (const sd of swapData) {
      dancers[sd.protoId].x = sd.startX + (sd.targetX - sd.startX) * tEased + sd.perpX * lateral;
      dancers[sd.protoId].y = sd.startY + (sd.targetY - sd.startY) * tEased + sd.perpY * lateral;
      dancers[sd.protoId].facing = sd.facingDeg;
    }
    result.push({ beat, dancers, hands: beat <= halfwayBeat ? handsFirst : handsSecond });
  }
  return result;
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

    const dancers = {} as Record<ProtoDancerId, DancerState>;
    for (const id of PROTO_DANCER_IDS) {
      if (groupA.has(id)) {
        const src = kfA ? kfA.dancers[id] : prev.dancers[id];
        dancers[id] = { x: src.x, y: src.y, facing: src.facing };
      } else {
        const src = kfB ? kfB.dancers[id] : prev.dancers[id];
        dancers[id] = { x: src.x, y: src.y, facing: src.facing };
      }
    }

    // Merge hands: combine entries from both timelines
    const handsA = kfA ? kfA.hands : prev.hands;
    const handsB = kfB ? kfB.hands : prev.hands;
    const mergedHands = {} as Record<ProtoDancerId, DancerHands>;
    for (const id of PROTO_DANCER_IDS) {
      mergedHands[id] = { ...handsA[id], ...handsB[id] };
    }

    merged.push({ beat, dancers, hands: mergedHands });
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
function buildBeatRanges(instructions: Instruction[]): { id: number; start: number; end: number }[] {
  const ranges: { id: number; start: number; end: number }[] = [];
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
): Map<number, string> {
  const ranges = buildBeatRanges(instructions);

  const warnings = new Map<number, string>();

  for (const kf of keyframes) {
    for (const proto of PROTO_DANCER_IDS) {
      const dh = kf.hands[proto];
      for (const hand of ['left', 'right'] as const) {
        const held = dh[hand];
        if (!held) continue;
        const posA = dancerPosition(makeDancerId(proto, 0), kf.dancers);
        const posB = dancerPosition(held[0], kf.dancers);
        const dist = Math.hypot(posA.x - posB.x, posA.y - posB.y);
        if (dist > maxDistance) {
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
  }

  return warnings;
}

export function validateHandSymmetry(keyframes: Keyframe[]): string[] {
  const errors: string[] = [];
  for (const kf of keyframes) {
    for (const proto of PROTO_DANCER_IDS) {
      for (const hand of ['left', 'right'] as const) {
        const held = kf.hands[proto][hand];
        if (!held) continue;
        const [targetId, targetHand] = held;
        const { proto: targetProto, offset } = parseDancerId(targetId);
        const reverse = kf.hands[targetProto][targetHand];
        const expectedReverse: DancerId = makeDancerId(proto, -offset);
        if (!reverse) {
          errors.push(`Beat ${kf.beat}: ${proto}.${hand} -> ${targetId}.${targetHand}, but ${targetProto}.${targetHand} is empty`);
        } else if (reverse[0] !== expectedReverse || reverse[1] !== hand) {
          errors.push(`Beat ${kf.beat}: ${proto}.${hand} -> ${targetId}.${targetHand}, but ${targetProto}.${targetHand} -> ${reverse[0]}.${reverse[1]} (expected ${expectedReverse}.${hand})`);
        }
      }
    }
  }
  return errors;
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

export function generateAllKeyframes(instructions: Instruction[]): Keyframe[] {
  const result: Keyframe[] = [initialKeyframe()];

  for (const instr of instructions) {
    const prev = result[result.length - 1];
    const newFrames = processTopLevelInstruction(prev, instr);
    result.push(...newFrames);
  }

  return result;
}
