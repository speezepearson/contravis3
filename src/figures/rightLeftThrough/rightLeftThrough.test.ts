import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { EAST, WEST } from '../../types';
import { tid, instr, expectFacingCloseTo } from '../testUtils';

describe('right_left_through', () => {
  // Improper formation:
  // up_lark (-0.5,-0.5) NORTH, up_robin (0.5,-0.5) NORTH
  // down_lark (0.5,0.5) SOUTH, down_robin (-0.5,0.5) SOUTH
  //
  // After crossing: each dancer moves to x = otherSide, keeping y
  // up_lark -> (1,-0.5), up_robin -> (-1,-0.5)
  // down_lark -> (-1,0.5), down_robin -> (1,0.5)
  //
  // After courtesy turn (180 CCW):
  // Lark with robin on right -> swap positions

  it('lark ends at {x: otherSide, y: robinCurrentY} facing across', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'right_left_through' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];

    // up_lark starts x<0 with foil down_robin (y=0.5)
    // After crossing + courtesy turn: up_lark ends at x=1, y=0.5
    // Facing across from x=1 -> WEST
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(1, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(0.5, 1);
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, WEST, 0);
  });

  it('dancers end facing across the set', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'right_left_through' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    for (const id of ['up_lark_0', 'up_robin_0', 'down_lark_0', 'down_robin_0'] as const) {
      const expected = last.dancers[id].pos.x < 0 ? EAST : WEST;
      expectFacingCloseTo(last.dancers[id].facing, expected, 0);
    }
  });

  it('ends holding left hands only', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'right_left_through' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Should have left-left hand connections
    for (const h of last.hands) {
      expect(h.ha).toBe('left');
      expect(h.hb).toBe('left');
    }
    expect(last.hands.length).toBeGreaterThan(0);
  });

  it('courtesy turn holds both hands during phase 2', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'right_left_through' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // A frame in the second half (phase 2) should have both left and right hands
    const threeQuarter = kfs[Math.floor(kfs.length * 3 / 4)];
    const leftHands = threeQuarter.hands.filter(h => h.ha === 'left' && h.hb === 'left');
    const rightHands = threeQuarter.hands.filter(h => h.ha === 'right' && h.hb === 'right');
    expect(leftHands.length).toBeGreaterThan(0);
    expect(rightHands.length).toBeGreaterThan(0);
  });
});
