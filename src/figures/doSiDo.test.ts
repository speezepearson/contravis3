import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { tid, instr, initialKeyframe, expectFacingCloseTo } from './testUtils';

describe('do_si_do', () => {
  it('dancers return to starting positions after 1 full rotation', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y, 1);
  });

  it('dancers maintain their original facing throughout', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    // Check mid-animation: facing should stay at initial values
    const mid = kfs[Math.floor(kfs.length / 2)];
    expectFacingCloseTo(mid.dancers['up_lark_0'].facing, init.dancers['up_lark_0'].facing, 1);
    expectFacingCloseTo(mid.dancers['down_robin_0'].facing, init.dancers['down_robin_0'].facing, 1);
  });

  it('no hand connections during do-si-do', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const mid = kfs[Math.floor(kfs.length / 2)];
    expect(mid.hands).toHaveLength(0);
  });

  it('dancers swap positions after half rotation', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'do_si_do', relationship: 'neighbor', rotations: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // up_lark (-0.5,-0.5) neighbors down_robin (-0.5,0.5) -- half orbit swaps them
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(-0.5, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(0.5, 1);
    expect(last.dancers['down_robin_0'].pos.x).toBeCloseTo(-0.5, 1);
    expect(last.dancers['down_robin_0'].pos.y).toBeCloseTo(-0.5, 1);
  });

  it('orbit is elliptical: perpendicular displacement is 0.25m, not full radius', () => {
    // up_lark (-0.5,-0.5) and down_robin (-0.5,0.5) are neighbors on the same vertical axis.
    // Center = (-0.5, 0), semiMajor (along y) = 0.5, semiMinor (along x) = 0.25.
    // At quarter rotation CW: up_lark -> east side of ellipse, down_robin -> west side.
    // Use many beats to make easeInOut(0.5) land exactly at quarter rotation.
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 0.5 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // Mid-animation (t=0.5, easeInOut=0.5) -> 0.25 rotations = quarter turn
    const mid = kfs[Math.floor(kfs.length / 2)];
    // CW orbit: up_lark (south of center) moves west first -> at quarter turn, west side
    expect(mid.dancers['up_lark_0'].pos.x).toBeCloseTo(-0.75, 1); // 0.25m west of center
    expect(mid.dancers['up_lark_0'].pos.y).toBeCloseTo(0, 1);
    // down_robin (north of center) moves east first -> at quarter turn, east side
    expect(mid.dancers['down_robin_0'].pos.x).toBeCloseTo(-0.25, 1); // 0.25m east of center
    expect(mid.dancers['down_robin_0'].pos.y).toBeCloseTo(0, 1);
  });
});
