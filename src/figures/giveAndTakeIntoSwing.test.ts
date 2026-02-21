import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { EAST, WEST } from '../types';
import { tid, instr } from './testUtils';

describe('give_and_take_into_swing', () => {
  // Set up: turn everyone to face across, so pairs are on opposite sides of the set
  function faceAcross() {
    return { id: tid(99), beats: 0, type: 'step' as const, direction: { kind: 'direction' as const, value: 'forward' as const }, distance: 0, facing: { kind: 'direction' as const, value: 'across' as const }, facingOffset: 0 };
  }

  it('errors when pairs have the same role', () => {
    const instructions = instr([
      faceAcross(),
      { id: tid(1), beats: 16, type: 'give_and_take_into_swing', relationship: 'opposite', role: 'lark',
        endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/opposite roles/);
  });

  it('errors when pairs are on the same side of the set', () => {
    // In initial improper, neighbors are on the same side (both at x=-0.5 or x=0.5)
    const instructions = instr([
      { id: tid(1), beats: 16, type: 'give_and_take_into_swing', relationship: 'neighbor', role: 'lark',
        endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/same side/i);
  });

  it('drawee walks halfway to drawer in the first beat', () => {
    // Use partner relationship: partners are on opposite sides in improper
    // up_lark (-0.5,-0.5) ↔ up_robin (0.5,-0.5)
    const instructions = instr([
      faceAcross(),
      { id: tid(1), beats: 16, type: 'give_and_take_into_swing', relationship: 'partner', role: 'lark',
        endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs, error } = generateAllKeyframes(instructions);
    expect(error).toBeNull();
    // At beat 1, drawee (up_robin) should be halfway from (0.5,-0.5) to (-0.5,-0.5) = (0,-0.5)
    const beat1 = kfs.reduce((best, kf) =>
      Math.abs(kf.beat - 1) < Math.abs(best.beat - 1) ? kf : best
    );
    expect(beat1.dancers['up_robin_0'].x).toBeCloseTo(0, 1);
    expect(beat1.dancers['up_robin_0'].y).toBeCloseTo(-0.5, 1);
  });

  it('center of mass drifts to final position (0.5m to drawer right for lark)', () => {
    const instructions = instr([
      faceAcross(),
      { id: tid(1), beats: 16, type: 'give_and_take_into_swing', relationship: 'partner', role: 'lark',
        endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs, error } = generateAllKeyframes(instructions);
    expect(error).toBeNull();
    const last = kfs[kfs.length - 1];
    // Drawer up_lark at (-0.5, -0.5) faces 90° (east). Right = south (0, -1).
    // Final CoM for pair (up_lark + up_robin): (-0.5, -0.5) + 0.5*(0, -1) = (-0.5, -1.0)
    const finalCx = (last.dancers['up_lark_0'].x + last.dancers['up_robin_0'].x) / 2;
    const finalCy = (last.dancers['up_lark_0'].y + last.dancers['up_robin_0'].y) / 2;
    expect(finalCx).toBeCloseTo(-0.5, 1);
    expect(finalCy).toBeCloseTo(-1.0, 1);
  });

  it('at the end, both dancers face the endFacing', () => {
    const instructions = instr([
      faceAcross(),
      { id: tid(1), beats: 16, type: 'give_and_take_into_swing', relationship: 'partner', role: 'lark',
        endFacing: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs, error } = generateAllKeyframes(instructions);
    expect(error).toBeNull();
    const last = kfs[kfs.length - 1];
    // Pair 1 ends on lark's side (x < 0): across = 90°
    expect(last.dancers['up_lark_0'].facing).toBeCloseTo(EAST, 0);
    expect(last.dancers['up_robin_0'].facing).toBeCloseTo(EAST, 0);
    // Pair 2 ends on lark's side (x > 0): across = 270°
    expect(last.dancers['down_lark_0'].facing).toBeCloseTo(WEST, 0);
    expect(last.dancers['down_robin_0'].facing).toBeCloseTo(WEST, 0);
  });
});
