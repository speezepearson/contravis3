import { describe, it, expect } from 'vitest';
import { ALL_DANCERS, generateAllKeyframes, initialKeyframe } from '../../generate';
import { AtomicInstructionSchema, InstructionSchema, ProtoDancerIdSchema, Vector, dancerPosition, headingAngle } from '../../types';
import { tid, instr, expectFacingCloseTo } from '../testUtils';
import { averagePos, resolveRelationship } from '../../generateUtils';
import z from 'zod';

const FACE_OPPOSITE = AtomicInstructionSchema.parse({ id: tid(0), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'relationship', value: { base: 'opposite', offset: 0 } }, facingOffset: 0 })

describe('circle', () => {
  it('dancers return to starting positions after full circle', () => {
    const instructions = AtomicInstructionSchema.array().parse([
      FACE_OPPOSITE,
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 1 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions, 'improper');
    const init = initialKeyframe('improper');
    const last = kfs[kfs.length - 1];
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 1);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y, 1);
    }
  });

  it('circle left moves clockwise', () => {
    const instructions = AtomicInstructionSchema.array().parse([
      FACE_OPPOSITE,
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions, 'improper');
    const last = kfs[kfs.length - 1];
    // Quarter CW: up_lark (-0.5,-0.5) -> (-0.5, 0.5) = down_robin's position
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(-0.5, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(0.5, 1);
  });

  it('circle right moves counter-clockwise', () => {
    const instructions = AtomicInstructionSchema.array().parse([
      FACE_OPPOSITE,
      { id: tid(1), beats: 8, type: 'circle', direction: 'right', rotations: 0.25 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions, 'improper');
    const last = kfs[kfs.length - 1];
    // Quarter CCW: up_lark (-0.5,-0.5) -> (0.5, -0.5) = up_robin's position
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(0.5, 1);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(-0.5, 1);
  });

  it('dancers face center throughout', () => {
    const instructions = AtomicInstructionSchema.array().parse([
      FACE_OPPOSITE,
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions, 'improper');
    const mid = kfs[Math.floor(kfs.length / 2)];
    const center = averagePos([...ALL_DANCERS].map(id => dancerPosition(id, mid.dancers).pos));
    // Each dancer should face toward center
    for (const id of ALL_DANCERS) {
      const d = mid.dancers[id];
      expectFacingCloseTo(d.facing, center.subtract(d.pos).normalize());
    }
  });

  it('has hand connections forming a ring', () => {
    const instructions = InstructionSchema.array().parse([
      FACE_OPPOSITE,
      { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 1 },
    ]);
    const keyframes = generateAllKeyframes(instructions, 'improper');
    expect(keyframes.error).toBeNull();
    const kfs = keyframes.keyframes;
    const mid = kfs[Math.floor(kfs.length / 2)];
    // Should have 4 hand connections (ring of 4 dancers)
    console.log('mid.hands', mid.hands);
    expect(mid.hands).toHaveLength(4);
  });
});
