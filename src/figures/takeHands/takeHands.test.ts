import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { parseDancerId } from '../../types';
import { tid, instr, initialKeyframe } from '../testUtils';

describe('take_hands', () => {
  it('adds hand connections for neighbor pairs', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
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
      { id: tid(1), beats: 2, type: 'take_hands', relationship: 'partner', hand: 'left' },
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
      { id: tid(1), beats: 0, type: 'take_hands', relationship: 'partner', hand: 'inside' },
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
      { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'inside' },
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
      { id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'relationship', value: 'partner' }, facingOffset: 0 },
      { id: tid(2), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'inside' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'down_robin_0', hb: 'right' });
    expect(last.hands).toContainEqual({ a: 'up_robin_0', ha: 'right', b: 'down_lark_0', hb: 'left' });
  });
});

describe('dynamic relationships (on_right, on_left, in_front)', () => {
  it('on_right in initial formation errors when a dancer has no valid candidate', () => {
    // up_lark (facing N) → up_robin is directly to the right, but
    // up_robin (facing N) has nobody within range in the on_right direction.
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: 'on_right', hand: 'right' },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
    expect(error!.instructionId).toBe(tid(1));
    expect(error!.message).toMatch(/no valid candidate for 'on_right'/);
  });

  it('on_right scoped to larks finds partner (improper formation)', () => {
    // In improper formation, up_lark faces N → on_right (70° CW) finds up_robin (to the east).
    // down_lark faces S → on_right (70° CW) finds down_robin (to the west).
    // Scoped to larks only, so robins (who have nobody on their right) are not evaluated.
    const instructions = instr([{
      id: tid(1), type: 'split', by: 'role',
      larks: [{ id: tid(10), beats: 0, type: 'take_hands', relationship: 'on_right', hand: 'right' }],
      robins: [],
    }]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'up_robin_0', hb: 'right' });
    expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'right', b: 'down_robin_0', hb: 'right' });
  });

  it('in_front in initial formation resolves to neighbor pairs', () => {
    // In initial improper: ups face north toward downs, downs face south toward ups
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: 'in_front', hand: 'left' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
    expect(last.hands).toContainEqual({ a: 'up_robin_0', ha: 'left', b: 'down_lark_0', hb: 'left' });
  });

  it('on_left after turning to face across resolves correctly', () => {
    // Turn everyone to face across, then "on your left" resolves per-dancer.
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'across' }, facingOffset: 0 },
      { id: tid(2), beats: 0, type: 'take_hands', relationship: 'on_left', hand: 'left' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // After facing across: up_lark faces 90° (east), up_robin faces 270° (west),
    // down_lark faces 270° (west), down_robin faces 90° (east)
    // up_lark (facing east): left = north → down_robin is directly north
    // down_lark (facing west): left = south → up_robin is directly south
    // up_robin and down_robin's left points out of the hands-four → cross-hands-four matches
    expect(last.hands).toHaveLength(4);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
    expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
  });

  it('in_front resolves across hands-fours when all dancers face the same direction', () => {
    // Turn everyone to face up, then "in_front" can't resolve within the hands-four
    // for down dancers (nobody is north of them within the same hands-four).
    // They should find dancers in the adjacent hands-four (offset +1).
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'up' }, facingOffset: 0 },
      { id: tid(2), beats: 0, type: 'take_hands', relationship: 'in_front', hand: 'right' },
    ]);
    const { keyframes: kfs } = generateAllKeyframes(instructions);
    const last = kfs[kfs.length - 1];
    // Check that at least one hand connection involves a non-zero offset (cross-hands-four)
    const hasNonZeroOffset = last.hands.some(h =>
      parseDancerId(h.a).offset !== 0 || parseDancerId(h.b).offset !== 0
    );
    expect(hasNonZeroOffset).toBe(true);
  });
});
