import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../generate';
import { NORTH, EAST, SOUTH, WEST, ProtoDancerIdSchema } from '../types';
import { tid, instr, initialKeyframe, expectFacingCloseTo } from './testUtils';

/** Helper: a step instruction with facing defaulting to forward+0. */
function stepInstr(overrides: Record<string, unknown>) {
  return {
    facing: { kind: 'direction', value: 'forward' },
    facingOffset: 0,
    ...overrides,
  };
}

describe('step', () => {
  it('moves dancers up by distance', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 5);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y + 1, 5);
    }
  });

  it('moves dancers down by distance', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.x).toBeCloseTo(init.dancers[id].pos.x, 5);
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y - 0.5, 5);
    }
  });

  it('moves dancers across (toward center of set)', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x + 0.5, 5);
    expect(last.dancers['up_robin_0'].pos.x).toBeCloseTo(init.dancers['up_robin_0'].pos.x - 0.5, 5);
  });

  it('moves dancers out (away from center)', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'out' }, distance: 0.5 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x - 0.5, 5);
    expect(last.dancers['up_robin_0'].pos.x).toBeCloseTo(init.dancers['up_robin_0'].pos.x + 0.5, 5);
  });

  it('moves dancers toward a relationship target', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'relationship', value: 'partner' }, distance: 0.5 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x + 0.5, 5);
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y, 5);
    expect(last.dancers['up_robin_0'].pos.x).toBeCloseTo(init.dancers['up_robin_0'].pos.x - 0.5, 5);
  });

  it('moves dancers in their progression direction', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 1 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y + 1, 5);
    expect(last.dancers['up_robin_0'].pos.y).toBeCloseTo(init.dancers['up_robin_0'].pos.y + 1, 5);
    expect(last.dancers['down_lark_0'].pos.y).toBeCloseTo(init.dancers['down_lark_0'].pos.y - 1, 5);
    expect(last.dancers['down_robin_0'].pos.y).toBeCloseTo(init.dancers['down_robin_0'].pos.y - 1, 5);
  });

  it('negative distance steps in the opposite direction', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: -1 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Negative progression = anti-progression
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y - 1, 5);
    expect(last.dancers['down_lark_0'].pos.y).toBeCloseTo(init.dancers['down_lark_0'].pos.y + 1, 5);
  });

  it('moves dancers forward (relative to their facing)', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 1 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Ups face 0 deg (north/+y), downs face 180 deg (south/-y)
    expect(last.dancers['up_lark_0'].pos.y).toBeCloseTo(init.dancers['up_lark_0'].pos.y + 1, 5);
    expect(last.dancers['down_lark_0'].pos.y).toBeCloseTo(init.dancers['down_lark_0'].pos.y - 1, 5);
  });

  it('moves dancers right (90 deg CW from facing)', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'right' }, distance: 1 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Ups face 0 deg, right = 90 deg = east (+x); downs face 180 deg, right = 270 deg = west (-x)
    expect(last.dancers['up_lark_0'].pos.x).toBeCloseTo(init.dancers['up_lark_0'].pos.x + 1, 5);
    expect(last.dancers['down_lark_0'].pos.x).toBeCloseTo(init.dancers['down_lark_0'].pos.x - 1, 5);
  });

  it('produces multiple keyframes with easing', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs.length).toBeGreaterThan(2);
    expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
  });

  it('preserves hands through step', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
      stepInstr({ id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
  });

  // --- Facing tests (formerly "turn" tests) ---

  it('changes facing to up (0 degrees)', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'up' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    for (const d of Object.values(last.dancers)) {
      expectFacingCloseTo(d.facing, NORTH);
    }
  });

  it('changes facing to down (180 degrees)', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'down' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    for (const d of Object.values(last.dancers)) {
      expectFacingCloseTo(d.facing, SOUTH);
    }
  });

  it('changes facing to across', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'across' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST);
  });

  it('changes facing to out', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'out' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, EAST);
  });

  it('changes facing to progression direction', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'progression' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, NORTH);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, NORTH);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, SOUTH);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, SOUTH);
  });

  it('facing forward preserves current facing', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, NORTH);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, SOUTH);
  });

  it('facing back reverses current facing', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'back' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, SOUTH);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, NORTH);
  });

  it('facing right turns 90 CW from current facing', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'right' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST);
  });

  it('facing left turns 90 CCW from current facing', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'left' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, EAST);
  });

  it('facingOffset rotates clockwise by given radians from facing', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'forward' }, facingOffset: Math.PI / 2 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, WEST);
  });

  it('negative facingOffset means counter-clockwise', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'forward' }, facingOffset: -Math.PI / 2 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, EAST);
  });

  it('applies facingOffset radians clockwise on top of facing direction', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'up' }, facingOffset: Math.PI / 2 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    for (const d of Object.values(last.dancers)) {
      expectFacingCloseTo(d.facing, EAST);
    }
  });

  it('changes facing toward a relationship target', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'relationship', value: 'partner' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_lark_0'].facing, WEST);
    expectFacingCloseTo(last.dancers['down_robin_0'].facing, EAST);
  });

  it('moves and changes facing simultaneously', () => {
    const instructions = instr([
      stepInstr({ id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1, facing: { kind: 'direction', value: 'across' }, facingOffset: 0 }),
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const init = initialKeyframe();
    const last = kfs[kfs.length - 1];
    // Position: all move up by 1
    for (const id of ProtoDancerIdSchema.options) {
      expect(last.dancers[id].pos.y).toBeCloseTo(init.dancers[id].pos.y + 1, 5);
    }
    // Facing: across
    expectFacingCloseTo(last.dancers['up_lark_0'].facing, EAST);
    expectFacingCloseTo(last.dancers['up_robin_0'].facing, WEST);
  });
});
