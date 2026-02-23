import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { tid, instr, initialKeyframe, expectFacingCloseTo } from '../testUtils';

describe('pass_by', () => {
  it('dancers swap positions', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pass_by', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // up_lark (-0.5,-0.5) swaps with neighbor down_robin (-0.5,0.5)
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['down_robin_0'].pos.x, 5);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['down_robin_0'].pos.y, 5);
    expect(last.dancers['down_robin_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x, 5);
    expect(last.dancers['down_robin_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y, 5);
  });

  it('dancers maintain original facing', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pass_by', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, init.dancers['up_lark_0'].facing, 5);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, init.dancers['down_robin_0'].facing, 5);
  });

  it('never adds hand connections', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pass_by', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // Skip initial keyframe (index 0), check all generated keyframes
    for (const kf of kfs.slice(1)) {
      expect(kf.hands).toEqual([]);
    }
  });

  it('right hand pass-by follows a CW elliptical path', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pass_by', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const mid = kfs[Math.floor(kfs.length / 2)];
    // up_lark_0 starts at (-0.5,-0.5), target (-0.5,0.5): travel is along y-axis
    // CW for northbound dancer -> curves west (x decreases)
    const startX = init.dancers['up_lark_0'].pos.x; // -0.5
    expect(mid.dancers['up_lark_0'].pos.x).toBeLessThan(startX - 0.1);
    // down_robin_0 travels south CW -> curves east (x increases)
    expect(mid.dancers['down_robin_0'].pos.x).toBeGreaterThan(startX + 0.1);
  });

  it('left hand pass-by follows a CCW elliptical path', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pass_by', relationship: { base: 'neighbor', offset: 0 }, hand: 'left' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const mid = kfs[Math.floor(kfs.length / 2)];
    const startX = init.dancers['up_lark_0'].pos.x; // -0.5
    // CCW for northbound dancer -> curves east (x increases)
    expect(mid.dancers['up_lark_0'].pos.x).toBeGreaterThan(startX + 0.1);
    // down_robin_0 travels south CCW -> curves west (x decreases)
    expect(mid.dancers['down_robin_0'].pos.x).toBeLessThan(startX - 0.1);
  });
});
