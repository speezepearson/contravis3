import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { NORTH, EAST, WEST, headingAngle } from '../types';
import { tid, instr, initialKeyframe, expectFacingCloseTo } from './testUtils';

describe('swing', () => {
  it('produces multiple keyframes spanning the beat count', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs.length).toBeGreaterThan(2);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
  });

  it('CoM at the end equals CoM at the beginning', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // up_lark/down_robin pair
    const initCx1 = (init.dancers['up_lark_0'].pos.x + init.dancers['down_robin_0'].pos.x) / 2;
    const initCy1 = (init.dancers['up_lark_0'].pos.y + init.dancers['down_robin_0'].pos.y) / 2;
    const finalCx1 = (last.dancers['up_lark_0'].pos.x + last.dancers['down_robin_0'].pos.x) / 2;
    const finalCy1 = (last.dancers['up_lark_0'].pos.y + last.dancers['down_robin_0'].pos.y) / 2;
    expect(finalCx1).toBeCloseTo(initCx1, 2);
    expect(finalCy1).toBeCloseTo(initCy1, 2);
    // up_robin/down_lark pair
    const initCx2 = (init.dancers['up_robin_0'].pos.x + init.dancers['down_lark_0'].pos.x) / 2;
    const initCy2 = (init.dancers['up_robin_0'].pos.y + init.dancers['down_lark_0'].pos.y) / 2;
    const finalCx2 = (last.dancers['up_robin_0'].pos.x + last.dancers['down_lark_0'].pos.x) / 2;
    const finalCy2 = (last.dancers['up_robin_0'].pos.y + last.dancers['down_lark_0'].pos.y) / 2;
    expect(finalCx2).toBeCloseTo(initCx2, 2);
    expect(finalCy2).toBeCloseTo(initCy2, 2);
  });

  it('during phase 1, the two dancers face opposite directions', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // Check at beat 4 (midpoint, solidly in phase 1)
    const mid = kfs.reduce((best, kf) =>
      Math.abs(kf.beat - 4) < Math.abs(best.beat - 4) ? kf : best
    );
    // up_lark and down_robin should face opposite directions
    const ulFacing = headingAngle(mid.dancers['up_lark_0'].facing);
    const drFacing = headingAngle(mid.dancers['down_robin_0'].facing);
    const diff1 = ((ulFacing - drFacing + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    expect(Math.abs(diff1)).toBeCloseTo(Math.PI, 0);
    // up_robin and down_lark should face opposite directions
    const urFacing = headingAngle(mid.dancers['up_robin_0'].facing);
    const dlFacing = headingAngle(mid.dancers['down_lark_0'].facing);
    const diff2 = ((dlFacing - urFacing + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    expect(Math.abs(diff2)).toBeCloseTo(Math.PI, 0);
  });

  it('at the end, both dancers face the endFacing', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // up_lark (x < 0): across = 90 deg (east)
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST, 0);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, EAST, 0);
    // down_lark (x > 0): across = 270 deg (west)
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST, 0);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, WEST, 0);
  });

  it('at the end, the robin is 1.0m to the lark\'s right', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // up_lark faces 90 deg (east), right = south (-y)
    // robin (down_robin) should be 1.0m to lark's right
    const ul = last.dancers['up_lark_0'];
    const dr = last.dancers['down_robin_0'];
    const ulAngle = headingAngle(ul.facing);
    const larkRightX = Math.cos(ulAngle);
    const larkRightY = -Math.sin(ulAngle);
    const dx = dr.pos.x - ul.pos.x;
    const dy = dr.pos.y - ul.pos.y;
    const rightComponent = dx * larkRightX + dy * larkRightY;
    expect(rightComponent).toBeCloseTo(1.0, 1);
    // Forward component should be ~0
    const fwdX = Math.sin(ulAngle);
    const fwdY = Math.cos(ulAngle);
    const fwdComponent = dx * fwdX + dy * fwdY;
    expect(fwdComponent).toBeCloseTo(0.0, 1);
  });

  it('partner swing works with endFacing up', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'partner', endFacing: { kind: 'direction', value: 'up' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Both dancers in each pair should face up (0 deg)
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, NORTH, 0);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, NORTH, 0);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, NORTH, 0);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, NORTH, 0);
  });

  it('errors when pairs have the same role', () => {
    // opposite: up_lark <-> down_lark (both larks)
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'opposite', endFacing: { kind: 'direction', value: 'up' } },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
    expect(error!.instructionId).toBe(tid(1));
    expect(error!.message).toMatch(/opposite roles/);
  });

  it('orbits clockwise (lark moves westward from initial south-of-CoM position)', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // up_lark starts south of CoM (-0.5, 0). CW from south goes west (decreasing x).
    const early = kfs[2]; // a few frames in
    expect(early.dancers['up_lark_0'].pos.x).toBeLessThan(-0.5);
  });
});
