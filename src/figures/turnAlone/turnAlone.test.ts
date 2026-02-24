import { describe, it, expect } from 'vitest';
import { generateAllKeyframes, initialKeyframe } from '../../generate';
import { SOUTH, NORTH } from '../../types';
import { tid, instr, expectFacingCloseTo, mustGenerateAllKeyframes } from '../testUtils';

describe('turn_alone', () => {
  it('every dancer faces opposite direction', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'turn_alone' },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    const last = kfs[kfs.length - 1];
    // up_lark starts facing NORTH -> ends facing SOUTH
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, SOUTH, 5);
    // down_robin starts facing SOUTH -> ends facing NORTH
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, NORTH, 5);
  });

  it('positions do not change', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'turn_alone' },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    const init = initialKeyframe('improper');
    const last = kfs[kfs.length - 1];
    for (const id of ['up_lark_0', 'up_robin_0', 'down_lark_0', 'down_robin_0'] as const) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 5);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y, 5);
    }
  });

  it('larks turn CW, robins turn CCW at midpoint', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'turn_alone' },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    // At midpoint, larks should have turned 90 CW, robins 90 CCW
    const mid = kfs[Math.floor(kfs.length / 2)];
    // up_lark starts facing NORTH (0,1). CW 90 -> EAST (1,0)
    expect(mid.dancers['up_lark_0'].facing.x).toBeGreaterThan(0.5);
    // up_robin starts facing NORTH (0,1). CCW 90 -> WEST (-1,0)
    expect(mid.dancers['up_robin_0'].facing.x).toBeLessThan(-0.5);
  });
});
