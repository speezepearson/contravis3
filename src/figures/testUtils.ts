import type { Instruction, Keyframe } from '../types';
import { InstructionSchema, NORTH, SOUTH } from '../types';
import { Vector } from 'vecti';
import { z } from 'zod';
import { expect } from 'vitest';

export function tid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Parse an array of raw instruction objects into branded Instructions. */
export function instr(data: unknown[]): Instruction[] {
  return z.array(InstructionSchema).parse(data);
}

/** Assert that a facing vector is close to an expected vector. */
export function expectFacingCloseTo(actual: Vector, expected: Vector, precision = 5) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

// Helper: the initial improper formation (beat 0, no hands)
export function initialKeyframe(): Keyframe {
  return {
    beat: 0,
    dancers: {
      up_lark_0:    { pos: new Vector(-0.5, -0.5), facing: NORTH },
      up_robin_0:   { pos: new Vector( 0.5, -0.5), facing: NORTH },
      down_lark_0:  { pos: new Vector( 0.5,  0.5), facing: SOUTH },
      down_robin_0: { pos: new Vector(-0.5,  0.5), facing: SOUTH },
    },
    hands: [],
  };
}
