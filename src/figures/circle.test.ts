import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { ProtoDancerIdSchema, headingAngle } from '../types';
import { tid, instr, initialKeyframe } from './testUtils';

describe('circle', () => {
  it('dancers return to starting positions after full circle', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 1);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y, 1);
    }
  });

  it('circle left moves clockwise', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Quarter CW: up_lark (-0.5,-0.5) -> (-0.5, 0.5) = down_robin's position
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(-0.5, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(0.5, 1);
  });

  it('circle right moves counter-clockwise', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'circle', direction: 'right', rotations: 0.25 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Quarter CCW: up_lark (-0.5,-0.5) -> (0.5, -0.5) = up_robin's position
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(0.5, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(-0.5, 1);
  });

  it('dancers face center throughout', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const mid = kfs[Math.floor(kfs.length / 2)];
    // Each dancer should face toward center (0,0)
    for (const id of ['up_lark_0', 'up_robin_0', 'down_lark_0', 'down_robin_0'] as const) {
      const d = mid.dancers[id];
      const TAU = 2 * Math.PI;
      const angleToCenter = ((Math.atan2(-d.pos.x, -d.pos.y)) % TAU + TAU) % TAU;
      const facing = ((headingAngle(d.facing) % TAU) + TAU) % TAU;
      expect(facing).toBeCloseTo(angleToCenter, 0);
    }
  });

  it('has hand connections forming a ring', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const mid = kfs[Math.floor(kfs.length / 2)];
    // Should have 4 hand connections (ring of 4 dancers)
    expect(mid.hands).toHaveLength(4);
  });
});
