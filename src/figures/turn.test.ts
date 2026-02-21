import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { NORTH, EAST, SOUTH, WEST } from '../types';
import { tid, instr, expectFacingCloseTo } from './testUtils';

describe('turn', () => {
  it('turns dancers to face up (0 degrees)', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    for (const d of Object.values(last.dancers)) {
      expectFacingCloseTo(d.facing, NORTH);
    }
  });

  it('turns dancers to face down (180 degrees)', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'down' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    for (const d of Object.values(last.dancers)) {
      expectFacingCloseTo(d.facing, SOUTH);
    }
  });

  it('turns dancers to face across', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'across' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST);
  });

  it('turns dancers to face out', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'out' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, EAST);
  });

  it('turns dancers to face progression direction', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'progression' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, NORTH);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, NORTH);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, SOUTH);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, SOUTH);
  });

  it('turns dancers to face forward (same as current facing)', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'forward' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Ups face 0°, downs face 180° — forward preserves facing
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, NORTH, 5);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, SOUTH, 5);
  });

  it('turns dancers to face back (opposite of current facing)', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'back' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, SOUTH, 5);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, NORTH, 5);
  });

  it('turns dancers to face right (90° CW from current facing)', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'right' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Ups face 0°, right = 90°; downs face 180°, right = 270°
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST, 5);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST, 5);
  });

  it('turns dancers to face left (90° CCW from current facing)', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'left' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Ups face 0°, left = 270°; downs face 180°, left = 90°
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, WEST, 5);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, EAST, 5);
  });

  it('offset rotates clockwise by given radians from target', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: Math.PI / 2, target: { kind: 'direction', value: 'forward' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Ups face NORTH + PI/2 = EAST; downs face SOUTH + PI/2 = WEST
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST, 5);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, EAST, 5);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST, 5);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, WEST, 5);
  });

  it('negative offset means counter-clockwise', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: -Math.PI / 2, target: { kind: 'direction', value: 'forward' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Ups face NORTH - PI/2 = WEST; downs face SOUTH - PI/2 = EAST
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, WEST, 5);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, EAST, 5);
  });

  it('applies offset radians clockwise on top of target direction', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: Math.PI / 2, target: { kind: 'direction', value: 'up' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // NORTH + PI/2 offset = EAST for all dancers
    for (const d of Object.values(last.dancers)) {
      expectFacingCloseTo(d.facing, EAST, 5);
    }
  });

  it('turns selected dancers toward a relationship target', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'relationship', value: 'partner' } },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST, 5);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, WEST, 5);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST, 5);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, EAST, 5);
  });
});
