import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { SOUTH } from '../../types';
import { tid, instr, initialKeyframe, expectFacingCloseTo } from '../testUtils';

describe('california_twirl', () => {
  // In improper formation, up_lark is at (-0.5,-0.5) facing NORTH,
  // up_robin is at (0.5,-0.5) facing NORTH. Robin is on lark's right.
  // down_lark is at (0.5,0.5) facing SOUTH, down_robin is at (-0.5,0.5) facing SOUTH.
  // Robin is on lark's right.

  it('dancers swap positions', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'california_twirl' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // up_lark and up_robin swap
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_robin_0'].pos.x, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_robin_0'].pos.y, 1);
    expect(last.dancers['up_robin_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x, 1);
    expect(last.dancers['up_robin_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y, 1);
  });

  it('dancers turn 180 degrees (lark CW, robin CCW)', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'california_twirl' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // up_lark started facing NORTH, turns CW 180 -> SOUTH
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, SOUTH, 1);
    // up_robin started facing NORTH, turns CCW 180 -> SOUTH
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, SOUTH, 1);
  });

  it('ends holding inside hands (lark right, robin left)', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'california_twirl' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'up_robin_0', hb: 'left' });
    expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'right', b: 'down_robin_0', hb: 'left' });
    expect(last.hands).toHaveLength(2);
  });

  it('holds inside hands during intermediates', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'california_twirl' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const mid = kfs[Math.floor(kfs.length / 2)];
    expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'up_robin_0', hb: 'left' });
  });

  it('follows CW elliptical path', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'california_twirl' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const mid = kfs[Math.floor(kfs.length / 2)];
    // up_lark and up_robin are side by side horizontally at y=-0.5
    // CW ellipse: at midpoint both should be displaced vertically
    const centerY = (init.dancers['up_lark_0'].pos.y + init.dancers['up_robin_0'].pos.y) / 2;
    expect(Math.abs(mid.dancers['up_lark_0'].pos.y - centerY)).toBeGreaterThan(0.05);
  });
});
