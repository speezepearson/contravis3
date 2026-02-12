import type { Instruction, Keyframe, Selector, Relationship, DancerState, HandConnection } from './types';

const DANCER_IDS = ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const;

const SELECTOR_MAP: Record<Selector, string[]> = {
  everyone: ['up_lark', 'up_robin', 'down_lark', 'down_robin'],
  larks:    ['up_lark', 'down_lark'],
  robins:   ['up_robin', 'down_robin'],
  ups:      ['up_lark', 'up_robin'],
  downs:    ['down_lark', 'down_robin'],
};

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

  // Precompute per-pair initial angles and radii
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
      // Move dancer A
      if (selected.has(pd.aId)) {
        const angle = pd.aAngle + angleOffset;
        dancers[pd.aId].x = pd.cx + pd.aRadius * Math.sin(angle);
        dancers[pd.aId].y = pd.cy + pd.aRadius * Math.cos(angle);
        // Face toward center
        const faceDeg = Math.atan2(pd.cx - dancers[pd.aId].x, pd.cy - dancers[pd.aId].y) * 180 / Math.PI;
        dancers[pd.aId].facing = ((faceDeg % 360) + 360) % 360;
      }

      // Move dancer B
      if (selected.has(pd.bId)) {
        const angle = pd.bAngle + angleOffset;
        dancers[pd.bId].x = pd.cx + pd.bRadius * Math.sin(angle);
        dancers[pd.bId].y = pd.cy + pd.bRadius * Math.cos(angle);
        // Face toward center
        const faceDeg = Math.atan2(pd.cx - dancers[pd.bId].x, pd.cy - dancers[pd.bId].y) * 180 / Math.PI;
        dancers[pd.bId].facing = ((faceDeg % 360) + 360) % 360;
      }
    }

    keyframes.push({
      beat,
      dancers,
      hands: prev.hands,
    });
  }

  return keyframes;
}

function generateFace(prev: Keyframe, instr: Extract<Instruction, { type: 'face' }>): Keyframe[] {
  const selected = new Set(SELECTOR_MAP[instr.selector]);
  const dancers = copyDancers(prev.dancers);
  const target = instr.target;

  for (const id of DANCER_IDS) {
    if (!selected.has(id)) continue;
    const d = dancers[id];

    if (target.kind === 'direction') {
      switch (target.value) {
        case 'up':     d.facing = 0; break;
        case 'down':   d.facing = 180; break;
        case 'across': d.facing = d.x < 0 ? 90 : 270; break;
        case 'out':    d.facing = d.x < 0 ? 270 : 90; break;
      }
    } else if (target.kind === 'degrees') {
      d.facing = target.value;
    } else if (target.kind === 'relationship') {
      // Find the relationship target dancer
      const pairs = RELATIONSHIP_PAIRS[target.value];
      let targetId: string | null = null;
      for (const [a, b] of pairs) {
        if (a === id) { targetId = b; break; }
        if (b === id) { targetId = a; break; }
      }
      if (targetId) {
        const t = dancers[targetId];
        const angle = Math.atan2(t.x - d.x, t.y - d.y) * 180 / Math.PI;
        d.facing = ((angle % 360) + 360) % 360;
      }
    }
  }

  return [{
    beat: prev.beat + instr.beats,
    dancers,
    hands: prev.hands,
  }];
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
      case 'face':
        newFrames = generateFace(prev, instr);
        break;
    }

    result.push(...newFrames);
  }

  return result;
}
