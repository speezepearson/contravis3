import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { tid, instr, initialKeyframe } from './testUtils';

describe('pull_by', () => {
  it('dancers swap positions', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
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
      { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].facing).toBeCloseTo(init.dancers['up_lark_0'].facing, 5);
    expect(last.dancers['down_robin_0'].facing).toBeCloseTo(init.dancers['down_robin_0'].facing, 5);
  });

  it('has hand connections during the pull-by', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const mid = kfs[Math.floor(kfs.length / 2)];
    expect(mid.hands.length).toBeGreaterThan(0);
    expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_robin_0', hb: 'right' });
  });

  it('right hand pull-by follows a CW elliptical path', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
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

  it('left hand pull-by follows a CCW elliptical path', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'left' },
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
