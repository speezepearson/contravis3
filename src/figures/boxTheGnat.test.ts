import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { NORTH, SOUTH } from '../types';
import { tid, instr, initialKeyframe } from './testUtils';

describe('box_the_gnat', () => {
  it('errors when pairs have the same role', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'box_the_gnat', relationship: 'opposite' },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/opposite roles/);
  });

  it('dancers trade places after box the gnat', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'box_the_gnat', relationship: 'neighbor' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // up_lark ↔ down_robin should swap positions
    expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['down_robin_0'].x, 1);
    expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['down_robin_0'].y, 1);
    expect(last.dancers['down_robin_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x, 1);
    expect(last.dancers['down_robin_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 1);
  });

  it('lark turns CW 180° and robin turns CCW 180°', () => {
    // First face neighbors toward each other, then box the gnat
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'relationship', value: 'neighbor' }, facingOffset: 0 },
      { id: tid(2), beats: 4, type: 'box_the_gnat', relationship: 'neighbor' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    // After turn: up_lark faces down_robin → facing 0° (up, since down_robin is north of up_lark)
    // After box the gnat: lark turns CW 180° → facing 180°
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].facing).toBeCloseTo(SOUTH, 0);
    // down_robin was facing up_lark → facing 180° (south), turns CCW 180° → facing 0°
    expect(last.dancers['down_robin_0'].facing).toBeCloseTo(NORTH, 0);
  });

  it('path follows an ellipse (midpoint is off the major axis)', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'box_the_gnat', relationship: 'neighbor' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    // At the midpoint of the motion, dancers should be displaced perpendicular to the
    // line connecting their start positions (the minor axis of the ellipse)
    const midBeat = 2;
    const mid = kfs.reduce((best, kf) =>
      Math.abs(kf.beat - midBeat) < Math.abs(best.beat - midBeat) ? kf : best
    );
    // The major axis for up_lark ↔ down_robin is vertical (same x).
    // The minor axis is horizontal. At the midpoint, up_lark should be displaced
    // horizontally from the center line (x = -0.5).
    const centerX = (init.dancers['up_lark_0'].x + init.dancers['down_robin_0'].x) / 2;
    expect(Math.abs(mid.dancers['up_lark_0'].x - centerX)).toBeGreaterThan(0.05);
    // Both dancers should be on opposite sides of the center
    expect(Math.sign(mid.dancers['up_lark_0'].x - centerX))
      .not.toBe(Math.sign(mid.dancers['down_robin_0'].x - centerX));
  });

  it('has right hand connections during the figure', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'box_the_gnat', relationship: 'neighbor' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const mid = kfs[Math.floor(kfs.length / 2)];
    expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_robin_0', hb: 'right' });
    expect(mid.hands).toContainEqual({ a: 'down_lark_0', ha: 'right', b: 'up_robin_0', hb: 'right' });
  });

  it('drops hands on the final frame', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'box_the_gnat', relationship: 'neighbor' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(0);
  });

  it('minor axis is half the major axis length', () => {
    const instructions = instr([
      { id: tid(1), beats: 4, type: 'box_the_gnat', relationship: 'neighbor' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    // Major axis length for up_lark ↔ down_robin = distance between them
    const majorLen = Math.hypot(
      init.dancers['up_lark_0'].x - init.dancers['down_robin_0'].x,
      init.dancers['up_lark_0'].y - init.dancers['down_robin_0'].y,
    );
    // At the midpoint, the dancer is at the end of the minor axis
    // The displacement from center perpendicular to major axis = semi-minor = majorLen/4
    const midBeat = 2;
    const mid = kfs.reduce((best, kf) =>
      Math.abs(kf.beat - midBeat) < Math.abs(best.beat - midBeat) ? kf : best
    );
    const centerX = (init.dancers['up_lark_0'].x + init.dancers['down_robin_0'].x) / 2;
    const centerY = (init.dancers['up_lark_0'].y + init.dancers['down_robin_0'].y) / 2;
    // For the neighbor pair on the same x, the major axis is vertical,
    // so the perpendicular displacement is horizontal
    const perpDisp = Math.hypot(
      mid.dancers['up_lark_0'].x - centerX,
      mid.dancers['up_lark_0'].y - centerY,
    );
    // At the eased midpoint, the position isn't exactly at semi-minor because of easing
    // At t=0.5 with easeInOut, θ = π * easeInOut(0.5) = π * 0.5 = π/2
    // position = a*cos(π/2)*major + b*sin(π/2)*minor = b*minor
    // So at the midpoint, displacement should equal semi-minor = majorLen/4
    expect(perpDisp).toBeCloseTo(majorLen / 4, 1);
  });
});
