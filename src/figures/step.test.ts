import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { ProtoDancerIdSchema } from '../types';
import { tid, instr, initialKeyframe } from './testUtils';

describe('step', () => {
  it('moves dancers up by distance', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 5);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y + 1, 5);
    }
  });

  it('moves dancers down by distance', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 5);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y - 0.5, 5);
    }
  });

  it('moves dancers across (toward center of set)', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x + 0.5, 5);
    expect(last.dancers['up_robin_0'].pos.x).toBeCloseTo(init.dancers['up_robin_0'].pos.x - 0.5, 5);
  });

  it('moves dancers out (away from center)', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'out' }, distance: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x - 0.5, 5);
    expect(last.dancers['up_robin_0'].pos.x).toBeCloseTo(init.dancers['up_robin_0'].pos.x + 0.5, 5);
  });

  it('moves dancers toward a relationship target', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'relationship', value: 'partner' }, distance: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x + 0.5, 5);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y, 5);
    expect(last.dancers['up_robin_0'].pos.x).toBeCloseTo(init.dancers['up_robin_0'].pos.x - 0.5, 5);
  });

  it('moves dancers in their progression direction', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y + 1, 5);
    expect(last.dancers['up_robin_0'].pos.y).toBeCloseTo(init.dancers['up_robin_0'].pos.y + 1, 5);
    expect(last.dancers['down_lark_0'].pos.y).toBeCloseTo(init.dancers['down_lark_0'].pos.y - 1, 5);
    expect(last.dancers['down_robin_0'].pos.y).toBeCloseTo(init.dancers['down_robin_0'].pos.y - 1, 5);
  });

  it('negative distance steps in the opposite direction', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: -1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Negative progression = anti-progression
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y - 1, 5);
    expect(last.dancers['down_lark_0'].pos.y).toBeCloseTo(init.dancers['down_lark_0'].pos.y + 1, 5);
  });

  it('moves dancers forward (relative to their facing)', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Ups face 0 deg (north/+y), downs face 180 deg (south/-y)
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y + 1, 5);
    expect(last.dancers['down_lark_0'].pos.y).toBeCloseTo(init.dancers['down_lark_0'].pos.y - 1, 5);
  });

  it('moves dancers right (90 deg CW from facing)', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'right' }, distance: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Ups face 0 deg, right = 90 deg = east (+x); downs face 180 deg, right = 270 deg = west (-x)
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x + 1, 5);
    expect(last.dancers['down_lark_0'].pos.x).toBeCloseTo(init.dancers['down_lark_0'].pos.x - 1, 5);
  });

  it('produces multiple keyframes with easing', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs.length).toBeGreaterThan(2);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
  });

  it('preserves hands through step', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
      { id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
  });
});
