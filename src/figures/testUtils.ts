import type { Instruction, Keyframe } from '../types';
import { InstructionSchema, NORTH, SOUTH } from '../types';
import { z } from 'zod';

export function tid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Parse an array of raw instruction objects into branded Instructions. */
export function instr(data: unknown[]): Instruction[] {
  return z.array(InstructionSchema).parse(data);
}

// Helper: the initial improper formation (beat 0, no hands)
export function initialKeyframe(): Keyframe {
  return {
    beat: 0,
    dancers: {
      up_lark_0:    { x: -0.5, y: -0.5, facing: NORTH },
      up_robin_0:   { x:  0.5, y: -0.5, facing: NORTH },
      down_lark_0:  { x:  0.5, y:  0.5, facing: SOUTH },
      down_robin_0: { x: -0.5, y:  0.5, facing: SOUTH },
    },
    hands: [],
  };
}
