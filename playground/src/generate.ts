import type { Instruction, Keyframe, Selector, Relationship, RelativeDirection, DancerState, HandConnection } from './types';

const DANCER_IDS = ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const;

const SELECTOR_MAP: Record<Selector, string[]> = {
  everyone: ['up_lark', 'up_robin', 'down_lark', 'down_robin'],
  larks:    ['up_lark', 'down_lark'],
  robins:   ['up_robin', 'down_robin'],
  ups:      ['up_lark', 'up_robin'],
  downs:    ['down_lark', 'down_robin'],
};

const UPS = new Set(['up_lark', 'up_robin']);

const RELATIONSHIP_PAIRS: Record<Relationship, [string, string][]> = {
  partner:  [['up_lark', 'up_robin'], ['down_lark', 'down_robin']],
  neighbor: [['up_lark', 'down_robin'], ['up_robin', 'down_lark']],
  opposite: [['up_lark', 'down_lark'], ['up_robin', 'down_robin']],
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

/** Filter relationship pairs to only those where both dancers are selected. */
function selectedPairs(relationship: Relationship, selector: Selector): [string, string][] {
  const selected = new Set(SELECTOR_MAP[selector]);
  return RELATIONSHIP_PAIRS[relationship].filter(([a, b]) => selected.has(a) && selected.has(b));
}

function easeInOut(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

/** Resolve a RelativeDirection to an absolute heading in radians for a specific dancer.
 *  Uses atan2(dx,dy) convention: 0 = +y (north/up on screen). */
function resolveHeading(dir: RelativeDirection, d: DancerState, id: string, dancers: Record<string, DancerState>): number {
  if (dir.kind === 'cw') {
    // CW degrees relative to current facing
    return (d.facing + dir.value) * Math.PI / 180;
  }
  if (dir.kind === 'direction') {
    switch (dir.value) {
      case 'up':               return 0;
      case 'down':             return Math.PI;
      case 'across':           return d.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      case 'out':              return d.x < 0 ? -Math.PI / 2 : Math.PI / 2;
      case 'progression':      return UPS.has(id) ? 0 : Math.PI;
      case 'anti-progression': return UPS.has(id) ? Math.PI : 0;
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

function generateTakeHands(prev: Keyframe, instr: Extract<Instruction, { type: 'take_hands' }>): Keyframe[] {
  const pairs = selectedPairs(instr.relationship, instr.selector);
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

function generateDropHands(prev: Keyframe, instr: Extract<Instruction, { type: 'drop_hands' }>): Keyframe[] {
  const pairs = selectedPairs(instr.relationship, instr.selector);
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

function generateAllemande(prev: Keyframe, instr: Extract<Instruction, { type: 'allemande' }>): Keyframe[] {
  const pairs = selectedPairs(instr.relationship, instr.selector);
  const selected = new Set(SELECTOR_MAP[instr.selector]);
  const totalAngleDeg = instr.rotations * 360 * (instr.direction === 'cw' ? 1 : -1);
  const totalAngleRad = totalAngleDeg * Math.PI / 180;
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

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
      if (selected.has(pd.aId)) {
        const angle = pd.aAngle + angleOffset;
        dancers[pd.aId].x = pd.cx + pd.aRadius * Math.sin(angle);
        dancers[pd.aId].y = pd.cy + pd.aRadius * Math.cos(angle);
        const faceDeg = Math.atan2(pd.cx - dancers[pd.aId].x, pd.cy - dancers[pd.aId].y) * 180 / Math.PI;
        dancers[pd.aId].facing = ((faceDeg % 360) + 360) % 360;
      }

      if (selected.has(pd.bId)) {
        const angle = pd.bAngle + angleOffset;
        dancers[pd.bId].x = pd.cx + pd.bRadius * Math.sin(angle);
        dancers[pd.bId].y = pd.cy + pd.bRadius * Math.cos(angle);
        const faceDeg = Math.atan2(pd.cx - dancers[pd.bId].x, pd.cy - dancers[pd.bId].y) * 180 / Math.PI;
        dancers[pd.bId].facing = ((faceDeg % 360) + 360) % 360;
      }
    }

    keyframes.push({ beat, dancers, hands: prev.hands });
  }

  return keyframes;
}

function generateTurn(prev: Keyframe, instr: Extract<Instruction, { type: 'turn' }>): Keyframe[] {
  const selected = new Set(SELECTOR_MAP[instr.selector]);
  const dancers = copyDancers(prev.dancers);

  for (const id of DANCER_IDS) {
    if (!selected.has(id)) continue;
    dancers[id].facing = resolveFacing(instr.target, prev.dancers[id], id, prev.dancers);
  }

  return [{
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  }];
}

function generateStep(prev: Keyframe, instr: Extract<Instruction, { type: 'step' }>): Keyframe[] {
  const selected = new Set(SELECTOR_MAP[instr.selector]);
  const nFrames = Math.max(1, Math.round(instr.beats / 0.25));

  const displacements: Record<string, { dx: number; dy: number }> = {};
  for (const id of DANCER_IDS) {
    if (!selected.has(id)) continue;
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

// --- Top-level generator ---

export function generateAllKeyframes(instructions: Instruction[]): Keyframe[] {
  const result: Keyframe[] = [initialKeyframe()];

  for (const instr of instructions) {
    const prev = result[result.length - 1];
    let newFrames: Keyframe[];

    switch (instr.type) {
      case 'take_hands':
        newFrames = generateTakeHands(prev, instr);
        break;
      case 'drop_hands':
        newFrames = generateDropHands(prev, instr);
        break;
      case 'allemande':
        newFrames = generateAllemande(prev, instr);
        break;
      case 'turn':
        newFrames = generateTurn(prev, instr);
        break;
      case 'step':
        newFrames = generateStep(prev, instr);
        break;
    }

    result.push(...newFrames);
  }

  return result;
}
