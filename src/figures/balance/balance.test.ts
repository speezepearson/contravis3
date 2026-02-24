import { describe, it, expect } from 'vitest';
import { generateAllKeyframes, initialKeyframe } from '../../generate';
import { ProtoDancerIdSchema } from '../../types';
import { tid, instr, mustGenerateAllKeyframes } from '../testUtils';

describe('balance', () => {
  it('dancers end at their starting position after a balance', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'balance', relationship: { base: 'neighbor', offset: 0 }, distance: 0.2 },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    const init = initialKeyframe('improper');
    const last = kfs[kfs.length - 1];
    // Balance: step 0.2 across, then step -0.2 across -> net zero
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 5);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y, 5);
    }
  });

  it('balance produces multiple keyframes', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'balance', relationship: { base: 'neighbor', offset: 0 }, distance: 0.2 },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    expect(kfs.length).toBeGreaterThan(2);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
  });

  it('balance beats accumulate correctly', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'balance', relationship: { base: 'neighbor', offset: 0 }, distance: 0.2 },
      { id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(6, 5);
  });
});
