import type { Instruction, AtomicInstruction, Keyframe, Relationship, RelativeDirection, DancerState, HandConnection } from './types';

const DANCER_IDS = ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const;
const ALL_DANCERS = new Set<string>(DANCER_IDS);

const UPS = new Set(['up_lark', 'up_robin']);

const RELATIONSHIP_PAIRS: Record<Relationship, [string, string][]> = {
  partner:  [['up_lark', 'up_robin'], ['down_lark', 'down_robin']],
  neighbor: [['up_lark', 'down_robin'], ['up_robin', 'down_lark']],
  opposite: [['up_lark', 'down_lark'], ['up_robin', 'down_robin']],
};

const SPLIT_GROUPS: Record<'role' | 'position', [Set<string>, Set<string>]> = {
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

function copyDancers(dancers: Record<string, DancerState>): Record<string, DancerState> {
  const result: Record<string, DancerState> = {};
  for (const id of DANCER_IDS) {
    const d = dancers[id];
    result[id] = { x: d.x, y: d.y, facing: d.facing };
  }
  return result;
}

/** Filter relationship pairs to only those where both dancers are in scope. */
function scopedPairs(relationship: Relationship, scope: Set<string>): [string, string][] {
  return RELATIONSHIP_PAIRS[relationship].filter(([a, b]) => scope.has(a) && scope.has(b));
}

function easeInOut(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

/** Resolve a RelativeDirection to an absolute heading in radians for a specific dancer.
 *  Uses atan2(dx,dy) convention: 0 = +y (north/up on screen). */
function resolveHeading(dir: RelativeDirection, d: DancerState, id: string, dancers: Record<string, DancerState>): number {
  if (dir.kind === 'cw') {
    return (d.facing + dir.value) * Math.PI / 180;
  }
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
  const pairs = RELATIONSHIP_PAIRS[dir.value];
  let targetId: string | null = null;
  for (const [a, b] of pairs) {
    if (a === id) { targetId = b; break; }
    if (b === id) { targetId = a; break; }
  }
  if (targetId) {
    const t = dancers[targetId];
    return Math.atan2(t.x - d.x, t.y - d.y);
  }
  return 0;
}

/** Resolve a RelativeDirection to an absolute facing in degrees. */
function resolveFacing(dir: RelativeDirection, d: DancerState, id: string, dancers: Record<string, DancerState>): number {
  if (dir.kind === 'cw') {
    return ((d.facing + dir.value) % 360 + 360) % 360;
  }
  const heading = resolveHeading(dir, d, id, dancers);
  return ((heading * 180 / Math.PI) % 360 + 360) % 360;
}

// --- Per-instruction generators ---

function generateTakeHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'take_hands' }>, scope: Set<string>): Keyframe[] {
  const pairs = scopedPairs(instr.relationship, scope);
  const newHands: HandConnection[] = [...prev.hands];
  for (const [a, b] of pairs) {
    newHands.push({ a, ha: instr.hand, b, hb: instr.hand });
  }
  return [{
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: newHands,
  }];
}

function generateDropHands(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'drop_hands' }>, scope: Set<string>): Keyframe[] {
  const pairs = scopedPairs(instr.relationship, scope);
  const pairSet = new Set(pairs.map(([a, b]) => `${a}:${b}`));
  const newHands = prev.hands.filter(h => {
    const fwd = `${h.a}:${h.b}`;
    const rev = `${h.b}:${h.a}`;
    return !pairSet.has(fwd) && !pairSet.has(rev);
  });
  return [{
    beat: prev.beat + instr.beats,
    dancers: copyDancers(prev.dancers),
    hands: newHands,
  }];
}

function generateAllemande(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'allemande' }>, scope: Set<string>): Keyframe[] {
  const pairs = scopedPairs(instr.relationship, scope);
  // right = CW, left = CCW
  const totalAngleDeg = instr.rotations * 360 * (instr.handedness === 'right' ? 1 : -1);
  const totalAngleRad = totalAngleDeg * Math.PI / 180;
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));
  // Shoulder offset: right hand → face 90° CCW from partner; left → 90° CW
  const shoulderOffset = instr.handedness === 'right' ? -90 : 90;

  // Build hand connections for the allemande pairs
  const allemandHands: HandConnection[] = pairs.map(([a, b]) => ({
    a, ha: instr.handedness, b, hb: instr.handedness,
  }));
  const hands = [...prev.hands, ...allemandHands];

  const keyframes: Keyframe[] = [];

  const pairData = pairs.map(([aId, bId]) => {
    const da = prev.dancers[aId];
    const db = prev.dancers[bId];
    const cx = (da.x + db.x) / 2;
    const cy = (da.y + db.y) / 2;
    return {
      aId, bId, cx, cy,
      aAngle: Math.atan2(da.x - cx, da.y - cy),
      aRadius: Math.hypot(da.x - cx, da.y - cy),
      bAngle: Math.atan2(db.x - cx, db.y - cy),
      bRadius: Math.hypot(db.x - cx, db.y - cy),
    };
  });

  for (let i = 1; i <= nFrames; i++) {
    const t = i / nFrames;
    const beat = prev.beat + t * instr.beats;
    const tEased = easeInOut(t);
    const angleOffset = tEased * totalAngleRad;

    const dancers = copyDancers(prev.dancers);

    for (const pd of pairData) {
      if (scope.has(pd.aId)) {
        const angle = pd.aAngle + angleOffset;
        dancers[pd.aId].x = pd.cx + pd.aRadius * Math.sin(angle);
        dancers[pd.aId].y = pd.cy + pd.aRadius * Math.cos(angle);
        const dirToPartner = Math.atan2(pd.cx - dancers[pd.aId].x, pd.cy - dancers[pd.aId].y) * 180 / Math.PI;
        dancers[pd.aId].facing = ((dirToPartner + shoulderOffset) % 360 + 360) % 360;
      }

      if (scope.has(pd.bId)) {
        const angle = pd.bAngle + angleOffset;
        dancers[pd.bId].x = pd.cx + pd.bRadius * Math.sin(angle);
        dancers[pd.bId].y = pd.cy + pd.bRadius * Math.cos(angle);
        const dirToPartner = Math.atan2(pd.cx - dancers[pd.bId].x, pd.cy - dancers[pd.bId].y) * 180 / Math.PI;
        dancers[pd.bId].facing = ((dirToPartner + shoulderOffset) % 360 + 360) % 360;
      }
    }

    keyframes.push({ beat, dancers, hands });
  }

  return keyframes;
}

function generateTurn(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'turn' }>, scope: Set<string>): Keyframe[] {
  const dancers = copyDancers(prev.dancers);

  for (const id of DANCER_IDS) {
    if (!scope.has(id)) continue;
    dancers[id].facing = resolveFacing(instr.target, prev.dancers[id], id, prev.dancers);
  }

  return [{
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  }];
}

function generateStep(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'step' }>, scope: Set<string>): Keyframe[] {
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const displacements: Record<string, { dx: number; dy: number }> = {};
  for (const id of DANCER_IDS) {
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
    for (const id of DANCER_IDS) {
      const disp = displacements[id];
      if (!disp) continue;
      dancers[id].x = prev.dancers[id].x + disp.dx * tEased;
      dancers[id].y = prev.dancers[id].y + disp.dy * tEased;
    }
    keyframes.push({ beat, dancers, hands: prev.hands });
  }
  return keyframes;
}

function generateBalance(prev: Keyframe, instr: Extract<AtomicInstruction, { type: 'balance' }>, scope: Set<string>): Keyframe[] {
  const halfBeats = instr.beats / 2;
  const stepOut = { id: 0, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: instr.distance };
  const outFrames = generateStep(prev, stepOut, scope);
  const lastOut = outFrames.length > 0 ? outFrames[outFrames.length - 1] : prev;
  const stepBack = { id: 0, beats: halfBeats, type: 'step' as const, direction: instr.direction, distance: -instr.distance };
  const backFrames = generateStep(lastOut, stepBack, scope);
  return [...outFrames, ...backFrames];
}

// --- Process a list of atomic instructions with a given scope ---

function processAtomicInstruction(prev: Keyframe, instr: AtomicInstruction, scope: Set<string>): Keyframe[] {
  switch (instr.type) {
    case 'take_hands':  return generateTakeHands(prev, instr, scope);
    case 'drop_hands':  return generateDropHands(prev, instr, scope);
    case 'allemande':   return generateAllemande(prev, instr, scope);
    case 'turn':        return generateTurn(prev, instr, scope);
    case 'step':        return generateStep(prev, instr, scope);
    case 'balance':     return generateBalance(prev, instr, scope);
  }
}

function processInstructions(prev: Keyframe, instructions: AtomicInstruction[], scope: Set<string>): Keyframe[] {
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

    const dancers: Record<string, DancerState> = {};
    for (const id of DANCER_IDS) {
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
