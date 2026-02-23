import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { tid, instr, initialKeyframe } from '../testUtils';

describe('take_hands', () => {
  it('adds hand connections for neighbor pairs', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    expect(kfs).toHaveLength(2);
    const last = kfs[kfs.length - 1];
    expect(last.beat).toBe(0);
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_robin_0', hb: 'right' });
    expect(last.hands).toContainEqual({ a: 'up_robin_0', ha: 'right', b: 'down_lark_0', hb: 'right' });
    expect(last.dancers).toEqual(initialKeyframe().dancers);
  });

  it('adds hand connections for partner pairs', () => {
    const instructions = instr([
      { id: tid(1), beats: 2, type: 'take_hands', relationship: { base: 'partner', offset: 0 }, hand: 'left' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.beat).toBe(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
    expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
  });

  it('inside hand with partner: each dancer uses the hand closer to their partner', () => {
    // Improper: up_lark (-0.5,-0.5 facing 0°) partner up_robin (0.5,-0.5 facing 0°)
    // up_robin is to up_lark's right → up_lark uses right
    // up_lark is to up_robin's left → up_robin uses left
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: { base: 'partner', offset: 0 }, hand: 'inside' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'up_robin_0', hb: 'left' });
    expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'right', b: 'down_robin_0', hb: 'left' });
  });

  it('inside hand errors when target is directly in front', () => {
    // Improper: neighbors are directly in front of each other
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: { base: 'neighbor', offset: 0 }, hand: 'inside' },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
    expect(error!.instructionId).toBe(tid(1));
    expect(error!.message).toMatch(/neither to the left nor to the right/);
  });

  it('inside hand with neighbor after turning to face partner', () => {
    // Turn everyone to face partner, then take inside hands with neighbor.
    // After facing partner: up_lark faces east (90°), up_robin faces west (270°),
    // down_lark faces west (270°), down_robin faces east (90°).
    // up_lark's neighbor is down_robin (at -0.5, 0.5) — north of up_lark.
    // Facing east (90°), north = left → up_lark uses left.
    // down_robin (at -0.5, 0.5) faces east (90°), up_lark is south → right.
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'step', direction: { dir: { kind: 'direction', value: 'forward' }, offsetRad: 0 }, distance: 0, facing: { dir: { kind: 'relationship', value: { base: 'partner', offset: 0 } }, offsetRad: 0 } },
      { id: tid(2), beats: 0, type: 'take_hands', relationship: { base: 'neighbor', offset: 0 }, hand: 'inside' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'down_robin_0', hb: 'right' });
    expect(last.hands).toContainEqual({ a: 'up_robin_0', ha: 'right', b: 'down_lark_0', hb: 'left' });
  });
});

