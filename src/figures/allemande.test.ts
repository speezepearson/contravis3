import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { tid, instr, initialKeyframe } from './testUtils';

describe('allemande', () => {
  it('produces multiple keyframes for the arc', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs.length).toBeGreaterThan(2);
    expect(kfs[0].beat).toBe(0);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
  });

  it('dancers return to approximately their starting positions after 1 full rotation', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x, 1);
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 1);
  });

  it('dancers swap positions after half rotation', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].x).toBeCloseTo(-0.5, 1);
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(0.5, 1);
    expect(last.dancers['down_robin_0'].x).toBeCloseTo(-0.5, 1);
    expect(last.dancers['down_robin_0'].y).toBeCloseTo(-0.5, 1);
  });

  it('allemande right: right shoulder faces partner (facing is 90° CCW from direction to partner)', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // Check a mid-animation frame
    const midIdx = Math.floor(kfs.length / 2);
    const mid = kfs[midIdx];
    // For up_lark, neighbor is down_robin. Direction to partner from up_lark's position.
    const ul = mid.dancers['up_lark_0'];
    const dr = mid.dancers['down_robin_0'];
    const TAU = 2 * Math.PI;
    const dirToPartner = Math.atan2(dr.x - ul.x, dr.y - ul.y);
    // Facing should be 90° CCW (i.e. -π/2) from direction to partner
    const expectedFacing = ((dirToPartner - Math.PI / 2) % TAU + TAU) % TAU;
    const actualFacing = ((ul.facing % TAU) + TAU) % TAU;
    expect(actualFacing).toBeCloseTo(expectedFacing, 0);
  });

  it('allemande left: left shoulder faces partner (facing is 90° CW from direction to partner)', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'left', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const midIdx = Math.floor(kfs.length / 2);
    const mid = kfs[midIdx];
    const ul = mid.dancers['up_lark_0'];
    const dr = mid.dancers['down_robin_0'];
    const TAU = 2 * Math.PI;
    const dirToPartner = Math.atan2(dr.x - ul.x, dr.y - ul.y);
    // Facing should be 90° CW (i.e. +π/2) from direction to partner
    const expectedFacing = ((dirToPartner + Math.PI / 2) % TAU + TAU) % TAU;
    const actualFacing = ((ul.facing % TAU) + TAU) % TAU;
    expect(actualFacing).toBeCloseTo(expectedFacing, 0);
  });

  it('allemande right adds right hand connections', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // All allemande keyframes should have hand connections
    const mid = kfs[Math.floor(kfs.length / 2)];
    expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_robin_0', hb: 'right' });
    expect(mid.hands).toContainEqual({ a: 'up_robin_0', ha: 'right', b: 'down_lark_0', hb: 'right' });
  });

  it('allemande left adds left hand connections', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'allemande', relationship: 'partner', handedness: 'left', rotations: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const mid = kfs[Math.floor(kfs.length / 2)];
    expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
    expect(mid.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
  });

  it('allemande left orbits counter-clockwise', () => {
    // Allemande left with neighbors: up_lark neighbors down_robin
    // CCW orbit: up_lark (at -0.5,-0.5) should move east first (toward +x)
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'left', rotations: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // After half rotation CCW, up_lark should be roughly where down_robin was
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].x).toBeCloseTo(-0.5, 1);
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(0.5, 1);
  });
});
