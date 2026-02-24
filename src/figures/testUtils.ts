import { InstructionSchema, type InitFormation, type Instruction, type Keyframe } from '../types';
import { Vector } from 'vecti';
import { z } from 'zod';
import { expect } from 'vitest';
import { generateAllKeyframes } from '../generate';

export function tid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Parse an array of raw instruction objects into branded Instructions. */
export function instr(data: unknown[]): Instruction[] {
  return z.array(InstructionSchema).parse(data);
}

/** Assert that a facing vector is close to an expected vector. */
export function expectFacingCloseTo(actual: Vector, expected: Vector, precision = 0.01) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

export function mustGenerateAllKeyframes(instructions: Instruction[], initFormation: InitFormation): Keyframe[] {
  const { keyframes, error } = generateAllKeyframes(instructions, initFormation);
  expect(error).toBeNull();
  return keyframes;
}
