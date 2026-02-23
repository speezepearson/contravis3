import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { NORTH, SOUTH } from '../../types';
import { tid, instr, initialKeyframe, expectFacingCloseTo } from '../testUtils';

describe('shoulder_round', () => {
  it('dancers maintain same center of mass', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'shoulder_round', relationship: { base: 'neighbor', offset: 0 }, handedness: 'right', endFacing: 'larks_up_robins_down' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // up_lark and down_robin are neighbors
    const initCenter = {
      x: (init.dancers['up_lark_0'].pos.x + init.dancers['down_robin_0'].pos.x) / 2,
      y: (init.dancers['up_lark_0'].pos.y + init.dancers['down_robin_0'].pos.y) / 2,
    };
    const finalCenter = {
      x: (last.dancers['up_lark_0'].pos.x + last.dancers['down_robin_0'].pos.x) / 2,
      y: (last.dancers['up_lark_0'].pos.y + last.dancers['down_robin_0'].pos.y) / 2,
    };
    expect(finalCenter.x).toBeCloseTo(initCenter.x, 1);
    expect(finalCenter.y).toBeCloseTo(initCenter.y, 1);
  });

  it('dancers end 0.5m apart', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'shoulder_round', relationship: { base: 'neighbor', offset: 0 }, handedness: 'right', endFacing: 'larks_up_robins_down' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    const dist = Math.hypot(
      last.dancers['up_lark_0'].pos.x - last.dancers['down_robin_0'].pos.x,
      last.dancers['up_lark_0'].pos.y - last.dancers['down_robin_0'].pos.y,
    );
    expect(dist).toBeCloseTo(0.5, 1);
  });

  it('dancers face correct directions (larks_up_robins_down)', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'shoulder_round', relationship: { base: 'neighbor', offset: 0 }, handedness: 'right', endFacing: 'larks_up_robins_down' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, NORTH, 1);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, SOUTH, 1);
  });

  it('dancers face correct directions (larks_down_robins_up)', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'shoulder_round', relationship: { base: 'neighbor', offset: 0 }, handedness: 'right', endFacing: 'larks_down_robins_up' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, SOUTH, 1);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, NORTH, 1);
  });

  it('each dancer is on the other\'s right (right shoulder)', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'shoulder_round', relationship: { base: 'neighbor', offset: 0 }, handedness: 'right', endFacing: 'larks_up_robins_down' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // up_lark faces NORTH. "right" from NORTH is EAST.
    // down_robin should be to the EAST of up_lark.
    expect(last.dancers['down_robin_0'].pos.x).toBeGreaterThan(last.dancers['up_lark_0'].pos.x - 0.01);
  });

  it('each dancer is on the other\'s left (left shoulder)', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'shoulder_round', relationship: { base: 'neighbor', offset: 0 }, handedness: 'left', endFacing: 'larks_up_robins_down' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // up_lark faces NORTH. "left" from NORTH is WEST.
    // down_robin should be to the WEST of up_lark.
    expect(last.dancers['down_robin_0'].pos.x).toBeLessThan(last.dancers['up_lark_0'].pos.x + 0.01);
  });

  it('has no hand connections', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'shoulder_round', relationship: { base: 'neighbor', offset: 0 }, handedness: 'right', endFacing: 'larks_up_robins_down' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toEqual([]);
  });
});
