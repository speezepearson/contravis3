import type { Instruction, AtomicInstruction, Keyframe, Relationship, RelativeDirection, DancerState, HandConnection, ProtoDancerId, DancerId } from './types';
import { makeDancerId, parseDancerId, dancerPosition } from './types';

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
    hands: [],
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
  return instr.beats;
}

export function validateHandDistances(
  instructions: Instruction[],
  keyframes: Keyframe[],
  maxDistance = 1.2
): Map<number, string> {
  // Build instruction beat ranges
  const ranges: { id: number; start: number; end: number }[] = [];
  let cumBeat = 0;
  for (const instr of instructions) {
    const dur = instructionDuration(instr);
    ranges.push({ id: instr.id, start: cumBeat, end: cumBeat + dur });
    cumBeat += dur;
  }

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

export function generateAllKeyframes(instructions: Instruction[]): Keyframe[] {
  const result: Keyframe[] = [initialKeyframe()];

  for (const instr of instructions) {
    const prev = result[result.length - 1];
    let newFrames: Keyframe[];

    if (instr.type === 'split') {
      newFrames = generateSplit(prev, instr);
    } else {
      newFrames = processAtomicInstruction(prev, instr, ALL_DANCERS);
    }

    result.push(...newFrames);
  }

  return result;
}
