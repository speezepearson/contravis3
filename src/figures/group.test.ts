import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { tid, instr, initialKeyframe } from './testUtils';

describe('group', () => {
  it('processes children sequentially', () => {
    const instructions = instr([{
      id: tid(1), type: 'group', label: 'Allemande figure',
      instructions: [
        { id: tid(10), beats: 2, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
        { id: tid(11), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // Should produce keyframes spanning 10 beats total (2 + 8)
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(10, 5);
    expect(kfs.length).toBeGreaterThan(2);
  });

  it('beats accumulate across groups and other instructions', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 0.5, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
      {
        id: tid(2), type: 'group', label: 'My group',
        instructions: [
          { id: tid(20), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
        ],
      },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
  });

  it('group can contain a split', () => {
    const instructions = instr([{
      id: tid(1), type: 'group', label: 'Split group',
      instructions: [{
        id: tid(10), type: 'split', by: 'role',
        larks: [{ id: tid(100), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
        robins: [{ id: tid(101), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
      }],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
    expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y - 1, 5);
  });

  it('empty group produces no keyframes', () => {
    const instructions = instr([{
      id: tid(1), type: 'group', label: 'Empty',
      instructions: [],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs).toHaveLength(1); // just the initial keyframe
  });
});
