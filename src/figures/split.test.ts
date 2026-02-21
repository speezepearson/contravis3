import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { NORTH, SOUTH } from '../types';
import { tid, instr, initialKeyframe } from './testUtils';

describe('split', () => {
  it('split by role: larks and robins do different things', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'role',
      larks: [{ id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
      robins: [{ id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Larks step up
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
    expect(last.dancers['down_lark_0'].y).toBeCloseTo(init.dancers['down_lark_0'].y + 1, 5);
    // Robins step down
    expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y - 1, 5);
    expect(last.dancers['down_robin_0'].y).toBeCloseTo(init.dancers['down_robin_0'].y - 1, 5);
  });

  it('split by position: ups and downs do different things', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'position',
      ups: [{ id: tid(10), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'down' }, facingOffset: 0 }],
      downs: [{ id: tid(11), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'up' }, facingOffset: 0 }],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Ups turn to face down
    expect(last.dancers['up_lark_0'].facing).toBe(SOUTH);
    expect(last.dancers['up_robin_0'].facing).toBe(SOUTH);
    // Downs turn to face up
    expect(last.dancers['down_lark_0'].facing).toBe(NORTH);
    expect(last.dancers['down_robin_0'].facing).toBe(NORTH);
  });

  it('empty larks list: larks hold still', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'role',
      larks: [],
      robins: [{ id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Larks unchanged
    expect(last.dancers['up_lark_0']).toEqual(init.dancers['up_lark_0']);
    expect(last.dancers['down_lark_0']).toEqual(init.dancers['down_lark_0']);
    // Robins moved
    expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y + 1, 5);
  });

  it('empty downs list: downs hold still', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'position',
      ups: [{ id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
      downs: [],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Ups moved across
    expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x + 0.5, 5);
    // Downs unchanged
    expect(last.dancers['down_lark_0']).toEqual(init.dancers['down_lark_0']);
    expect(last.dancers['down_robin_0']).toEqual(init.dancers['down_robin_0']);
  });

  it('both lists empty: no movement, 0 beats', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'role',
      larks: [],
      robins: [],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // Just the initial keyframe (no new keyframes from empty split)
    expect(kfs).toHaveLength(1);
  });

  it('split beats are computed from sub-lists', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'role',
      larks: [
        { id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
        { id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
      ],
      robins: [
        { id: tid(12), beats: 8, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
      ],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
  });

  it('split merges hands from both sub-timelines', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'role',
      larks: [{ id: tid(10), beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'right' }],
      robins: [{ id: tid(11), beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'left' }],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Larks opposite: (up_lark, down_lark) - only larks in scope, opposite has both larks
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_lark_0', hb: 'right' });
    // Robins opposite: (up_robin, down_robin) - only robins in scope
    expect(last.hands).toContainEqual({ a: 'up_robin_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
  });

  it('instructions after split continue from merged state', () => {
    const instructions = instr([
      {
        id: tid(1), type: 'split', by: 'role',
        larks: [{ id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
        robins: [{ id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
      },
      { id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Larks stepped up by 1, then across by 0.5
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
    expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x + 0.5, 5);
    // Robins stepped down by 1, then across by 0.5
    expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y - 1, 5);
    expect(last.dancers['up_robin_0'].x).toBeCloseTo(init.dancers['up_robin_0'].x - 0.5, 5);
  });

  it('split with allemande in one list and step in the other', () => {
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'position',
      ups: [{ id: tid(10), beats: 8, type: 'allemande', relationship: 'partner', handedness: 'right', rotations: 1 }],
      downs: [{ id: tid(11), beats: 8, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 }],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(kfs.length).toBeGreaterThan(2);
    expect(last.beat).toBeCloseTo(8, 5);
    // Ups did a full allemande, should return approximately to start
    expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x, 1);
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 1);
    // Downs stepped up by 1
    expect(last.dancers['down_lark_0'].y).toBeCloseTo(init.dancers['down_lark_0'].y + 1, 5);
    expect(last.dancers['down_robin_0'].y).toBeCloseTo(init.dancers['down_robin_0'].y + 1, 5);
  });
});
