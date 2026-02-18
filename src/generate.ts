import type { Instruction, AtomicInstruction, Keyframe, Relationship, RelativeDirection, DancerState, HandConnection, ProtoDancerId, DancerId } from './types';
import { makeDancerId, parseDancerId, dancerPosition, ProtoDancerIdSchema, buildDancerRecord } from './types';

const PROTO_DANCER_IDS = ProtoDancerIdSchema.options;
const ALL_DANCERS = new Set<ProtoDancerId>(PROTO_DANCER_IDS);

const UPS = new Set<ProtoDancerId>(['up_lark_0', 'up_robin_0']);

const STATIC_RELATIONSHIPS: Partial<Record<Relationship, Record<ProtoDancerId, ProtoDancerId>>> = {
  partner:  { up_lark_0: 'up_robin_0', up_robin_0: 'up_lark_0', down_lark_0: 'down_robin_0', down_robin_0: 'down_lark_0' },
  neighbor: { up_lark_0: 'down_robin_0', up_robin_0: 'down_lark_0', down_lark_0: 'up_robin_0', down_robin_0: 'up_lark_0' },
  opposite: { up_lark_0: 'down_lark_0', up_robin_0: 'down_robin_0', down_lark_0: 'up_lark_0', down_robin_0: 'up_robin_0' },
};

const SPLIT_GROUPS: Record<'role' | 'position', [Set<ProtoDancerId>, Set<ProtoDancerId>]> = {
  role:     [new Set(['up_lark_0', 'down_lark_0']), new Set(['up_robin_0', 'down_robin_0'])],
  position: [new Set(['up_lark_0', 'up_robin_0']), new Set(['down_lark_0', 'down_robin_0'])],
};

function initialKeyframe(): Keyframe {
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
  const staticMap = STATIC_RELATIONSHIPS[relationship];
  if (staticMap) {
    return makeDancerId(staticMap[id], 0);
  }
  // Dynamic: on_right (90°), on_left (-90°), in_front (0°)
  const targetAngle = relationship === 'on_right' ? 90 : relationship === 'on_left' ? -90 : 0;
  const d = dancers[id];
  let bestScore = Infinity;
  let bestAbsOffset = Infinity;
  let bestTarget: DancerId = makeDancerId(id, 0); // fallback
  for (const otherId of PROTO_DANCER_IDS) {
    if (otherId === id) continue;
    for (const offset of [-1, 0, 1]) {
      const targetId = makeDancerId(otherId, offset);
      const targetPos = dancerPosition(targetId, dancers);
      const heading = Math.atan2(targetPos.x - d.x, targetPos.y - d.y) * 180 / Math.PI;
      const rel = ((heading - d.facing + 540) % 360) - 180;
      const score = Math.abs(rel - targetAngle);
      if (score < bestScore || (score === bestScore && Math.abs(offset) < bestAbsOffset)) {
        bestScore = score;
        bestAbsOffset = Math.abs(offset);
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
  const newHands: HandConnection[] = [...prev.hands];
  const seen = new Set<string>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    const aId = makeDancerId(id, 0);
    const key = aId < target ? `${aId}:${target}` : `${target}:${aId}`;
    if (!seen.has(key)) {
      seen.add(key);
      newHands.push({ a: aId, ha: instr.hand, b: target, hb: instr.hand });
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
  const stepOut = { id: 0, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: instr.distance };
  const outFrames = generateStep(prev, stepOut, scope);
  const lastOut = outFrames.length > 0 ? outFrames[outFrames.length - 1] : prev;
  const stepBack = { id: 0, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: -instr.distance };
  const backFrames = generateStep(lastOut, stepBack, scope);
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
  const ringHands: HandConnection[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const a = makeDancerId(curr.protoId, 0);
    const b = makeDancerId(next.protoId, 0);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    ringHands.push({ a: lo, ha: 'left', b: hi, hb: 'right' });
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

  // Build swap pairs and hand connections
  const swapData: { protoId: ProtoDancerId; targetPos: { x: number; y: number }; originalFacing: number }[] = [];
  const pullHands: HandConnection[] = [];
  const seen = new Set<string>();
  for (const id of PROTO_DANCER_IDS) {
    if (!scope.has(id)) continue;
    const target = resolveRelationship(instr.relationship, id, prev.dancers);
    const da = prev.dancers[id];
    const targetPos = dancerPosition(target, prev.dancers);
    swapData.push({ protoId: id, targetPos: { x: targetPos.x, y: targetPos.y }, originalFacing: da.facing });
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
      const startX = prev.dancers[sd.protoId].x;
      const startY = prev.dancers[sd.protoId].y;
      dancers[sd.protoId].x = startX + (sd.targetPos.x - startX) * tEased;
      dancers[sd.protoId].y = startY + (sd.targetPos.y - startY) * tEased;
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

    result.push({ beat, dancers, hands: prev.hands });
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
    case 'swing':       return generateSwing(prev, instr, scope);
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
