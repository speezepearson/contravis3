import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { ProtoDancerIdSchema } from '../types';
import { tid, instr, initialKeyframe } from './testUtils';

describe('balance', () => {
  it('dancers end at their starting position after a balance', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'balance', direction: { kind: 'direction', value: 'across' }, distance: 0.2 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Balance: step 0.2 across, then step -0.2 across -> net zero
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 5);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y, 5);
    }
  });

  it('dancers are displaced at the midpoint of a balance', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'balance', direction: { kind: 'direction', value: 'up' }, distance: 0.2 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    // Find keyframe closest to beat 2 (midpoint)
    const mid = kfs.reduce((best, kf) =>
      Math.abs(kf.beat - 2) < Math.abs(best.beat - 2) ? kf : best
    );
    // At midpoint, dancers should be ~0.2 north of start
    expect(mid.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y + 0.2, 1);
  });

  it('balance produces multiple keyframes', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'balance', direction: { kind: 'direction', value: 'right' }, distance: 0.2 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs.length).toBeGreaterThan(2);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
  });

  it('balance beats accumulate correctly', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'balance', direction: { kind: 'direction', value: 'forward' }, distance: 0.2 },
      { id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(6, 5);
  });
});
