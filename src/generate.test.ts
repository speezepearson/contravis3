import { describe, it, expect } from 'vitest';
import { generateAllKeyframes, validateHandDistances } from './generate';
import type { Instruction, Keyframe } from './types';
import { parseDancerId, InstructionSchema, DanceSchema, ProtoDancerIdSchema } from './types';
import { z } from 'zod';

function tid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Parse an array of raw instruction objects into branded Instructions. */
function instr(data: unknown[]): Instruction[] {
  return z.array(InstructionSchema).parse(data);
}

// Helper: the initial improper formation (beat 0, no hands)
function initialKeyframe(): Keyframe {
  return {
    beat: 0,
    dancers: {
      up_lark_0:    { x: -0.5, y: -0.5, facing: 0 },
      up_robin_0:   { x:  0.5, y: -0.5, facing: 0 },
      down_lark_0:  { x:  0.5, y:  0.5, facing: 180 },
      down_robin_0: { x: -0.5, y:  0.5, facing: 180 },
    },
    hands: [],
  };
}

describe('generateAllKeyframes', () => {
  it('returns just the initial keyframe when no instructions', () => {
    const { keyframes: kfs } = generateAllKeyframes([]);
    expect(kfs).toHaveLength(1);
    expect(kfs[0].beat).toBe(0);
    expect(kfs[0].dancers).toEqual(initialKeyframe().dancers);
    expect(kfs[0].hands).toEqual([]);
  });

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
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'relationship', value: 'partner' } },
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
        listA: [{ id: tid(10), beats: 0, type: 'take_hands', relationship: 'on_right', hand: 'right' }],
        listB: [],
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
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'across' } },
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
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } },
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

  describe('drop_hands', () => {
    it('removes hand connections for the relationship', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: tid(2), beats: 0, type: 'drop_hands', target: 'neighbor' },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(0);
    });

    it('only removes the specified relationship hands', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: tid(2), beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: tid(3), beats: 0, type: 'drop_hands', target: 'neighbor' },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(2);
      expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
      expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
    });

    it('drops by hand: removes all connections using that hand', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: tid(2), beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: tid(3), beats: 0, type: 'drop_hands', target: 'right' },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Only partner left-hand connections remain
      expect(last.hands).toHaveLength(2);
      expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
      expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
    });

    it('drops both: removes all hand connections', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: tid(2), beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: tid(3), beats: 0, type: 'drop_hands', target: 'both' },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(0);
    });
  });

  describe('turn', () => {
    it('turns dancers to face up (0 degrees)', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(0);
      }
    });

    it('turns dancers to face down (180 degrees)', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'down' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(180);
      }
    });

    it('turns dancers to face across', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'across' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].facing).toBe(90);
      expect(last.dancers['down_robin_0'].facing).toBe(90);
      expect(last.dancers['up_robin_0'].facing).toBe(270);
      expect(last.dancers['down_lark_0'].facing).toBe(270);
    });

    it('turns dancers to face out', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'out' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].facing).toBe(270);
      expect(last.dancers['down_robin_0'].facing).toBe(270);
      expect(last.dancers['up_robin_0'].facing).toBe(90);
      expect(last.dancers['down_lark_0'].facing).toBe(90);
    });

    it('turns dancers to face progression direction', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'progression' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].facing).toBe(0);
      expect(last.dancers['up_robin_0'].facing).toBe(0);
      expect(last.dancers['down_lark_0'].facing).toBe(180);
      expect(last.dancers['down_robin_0'].facing).toBe(180);
    });

    it('turns dancers to face forward (same as current facing)', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'forward' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0°, downs face 180° — forward preserves facing
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(0, 5);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(180, 5);
    });

    it('turns dancers to face back (opposite of current facing)', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'back' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(180, 5);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(0, 5);
    });

    it('turns dancers to face right (90° CW from current facing)', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'right' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0°, right = 90°; downs face 180°, right = 270°
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(270, 5);
    });

    it('turns dancers to face left (90° CCW from current facing)', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'left' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0°, left = 270°; downs face 180°, left = 90°
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(90, 5);
    });

    it('offset rotates clockwise by given degrees from target', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 90, target: { kind: 'direction', value: 'forward' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0° + 90° = 90°; downs face 180° + 90° = 270°
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['up_robin_0'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_robin_0'].facing).toBeCloseTo(270, 5);
    });

    it('negative offset means counter-clockwise', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: -90, target: { kind: 'direction', value: 'forward' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0° - 90° = 270°; downs face 180° - 90° = 90°
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(90, 5);
    });

    it('applies offset degrees clockwise on top of target direction', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 90, target: { kind: 'direction', value: 'up' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Up (0°) + 90° offset = 90° (east) for all dancers
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBeCloseTo(90, 5);
      }
    });

    it('turns selected dancers toward a relationship target', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'turn', offset: 0, target: { kind: 'relationship', value: 'partner' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['up_robin_0'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_robin_0'].facing).toBeCloseTo(90, 5);
    });
  });

  describe('allemande', () => {
    it('produces multiple keyframes for the arc', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[0].beat).toBe(0);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('dancers return to approximately their starting positions after 1 full rotation', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 1);
    });

    it('dancers swap positions after half rotation', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(0.5, 1);
      expect(last.dancers['down_robin_0'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['down_robin_0'].y).toBeCloseTo(-0.5, 1);
    });

    it('allemande right: right shoulder faces partner (facing is 90° CCW from direction to partner)', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      // Check a mid-animation frame
      const midIdx = Math.floor(kfs.length / 2);
      const mid = kfs[midIdx];
      // For up_lark, neighbor is down_robin. Direction to partner from up_lark's position.
      const ul = mid.dancers['up_lark_0'];
      const dr = mid.dancers['down_robin_0'];
      const dirToPartner = Math.atan2(dr.x - ul.x, dr.y - ul.y) * 180 / Math.PI;
      // Facing should be 90° CCW (i.e. -90°) from direction to partner
      const expectedFacing = ((dirToPartner - 90) % 360 + 360) % 360;
      const actualFacing = ((ul.facing % 360) + 360) % 360;
      expect(actualFacing).toBeCloseTo(expectedFacing, 0);
    });

    it('allemande left: left shoulder faces partner (facing is 90° CW from direction to partner)', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'left', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const midIdx = Math.floor(kfs.length / 2);
      const mid = kfs[midIdx];
      const ul = mid.dancers['up_lark_0'];
      const dr = mid.dancers['down_robin_0'];
      const dirToPartner = Math.atan2(dr.x - ul.x, dr.y - ul.y) * 180 / Math.PI;
      // Facing should be 90° CW (i.e. +90°) from direction to partner
      const expectedFacing = ((dirToPartner + 90) % 360 + 360) % 360;
      const actualFacing = ((ul.facing % 360) + 360) % 360;
      expect(actualFacing).toBeCloseTo(expectedFacing, 0);
    });

    it('allemande right adds right hand connections', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      // All allemande keyframes should have hand connections
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_robin_0', hb: 'right' });
      expect(mid.hands).toContainEqual({ a: 'up_robin_0', ha: 'right', b: 'down_lark_0', hb: 'right' });
    });

    it('allemande left adds left hand connections', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'allemande', relationship: 'partner', handedness: 'left', rotations: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
      expect(mid.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
    });

    it('allemande left orbits counter-clockwise', () => {
      // Allemande left with neighbors: up_lark neighbors down_robin
      // CCW orbit: up_lark (at -0.5,-0.5) should move east first (toward +x)
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'left', rotations: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      // After half rotation CCW, up_lark should be roughly where down_robin was
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(0.5, 1);
    });
  });

  describe('step', () => {
    it('moves dancers up by distance', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of ProtoDancerIdSchema.options) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y + 1, 5);
      }
    });

    it('moves dancers down by distance', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of ProtoDancerIdSchema.options) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y - 0.5, 5);
      }
    });

    it('moves dancers across (toward center of set)', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x + 0.5, 5);
      expect(last.dancers['up_robin_0'].x).toBeCloseTo(init.dancers['up_robin_0'].x - 0.5, 5);
    });

    it('moves dancers out (away from center)', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'out' }, distance: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x - 0.5, 5);
      expect(last.dancers['up_robin_0'].x).toBeCloseTo(init.dancers['up_robin_0'].x + 0.5, 5);
    });


    it('moves dancers toward a relationship target', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'relationship', value: 'partner' }, distance: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x + 0.5, 5);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 5);
      expect(last.dancers['up_robin_0'].x).toBeCloseTo(init.dancers['up_robin_0'].x - 0.5, 5);
    });

    it('moves dancers in their progression direction', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
      expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y + 1, 5);
      expect(last.dancers['down_lark_0'].y).toBeCloseTo(init.dancers['down_lark_0'].y - 1, 5);
      expect(last.dancers['down_robin_0'].y).toBeCloseTo(init.dancers['down_robin_0'].y - 1, 5);
    });

    it('negative distance steps in the opposite direction', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: -1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Negative progression = anti-progression
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y - 1, 5);
      expect(last.dancers['down_lark_0'].y).toBeCloseTo(init.dancers['down_lark_0'].y + 1, 5);
    });

    it('moves dancers forward (relative to their facing)', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups face 0° (north/+y), downs face 180° (south/-y)
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
      expect(last.dancers['down_lark_0'].y).toBeCloseTo(init.dancers['down_lark_0'].y - 1, 5);
    });

    it('moves dancers right (90° CW from facing)', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'right' }, distance: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups face 0°, right = 90° = east (+x); downs face 180°, right = 270° = west (-x)
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x + 1, 5);
      expect(last.dancers['down_lark_0'].x).toBeCloseTo(init.dancers['down_lark_0'].x - 1, 5);
    });

    it('produces multiple keyframes with easing', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('preserves hands through step', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(2);
    });
  });

  describe('instruction sequencing', () => {
    it('beats accumulate across instructions', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } },
        { id: tid(2), beats: 4, type: 'turn', offset: 0, target: { kind: 'direction', value: 'down' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs[0].beat).toBe(0);
      expect(kfs[kfs.length - 1].beat).toBe(8);
    });
  });

  describe('split', () => {
    it('split by role: larks and robins do different things', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'role',
        listA: [{ id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
        listB: [{ id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Larks (group A) step up
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
      expect(last.dancers['down_lark_0'].y).toBeCloseTo(init.dancers['down_lark_0'].y + 1, 5);
      // Robins (group B) step down
      expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y - 1, 5);
      expect(last.dancers['down_robin_0'].y).toBeCloseTo(init.dancers['down_robin_0'].y - 1, 5);
    });

    it('split by position: ups and downs do different things', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'position',
        listA: [{ id: tid(10), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'down' } }],
        listB: [{ id: tid(11), beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } }],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups (group A) turn to face down
      expect(last.dancers['up_lark_0'].facing).toBe(180);
      expect(last.dancers['up_robin_0'].facing).toBe(180);
      // Downs (group B) turn to face up
      expect(last.dancers['down_lark_0'].facing).toBe(0);
      expect(last.dancers['down_robin_0'].facing).toBe(0);
    });

    it('empty listA: group A dancers hold still', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'role',
        listA: [],
        listB: [{ id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Larks unchanged
      expect(last.dancers['up_lark_0']).toEqual(init.dancers['up_lark_0']);
      expect(last.dancers['down_lark_0']).toEqual(init.dancers['down_lark_0']);
      // Robins moved
      expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y + 1, 5);
    });

    it('empty listB: group B dancers hold still', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'position',
        listA: [{ id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 }],
        listB: [],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups moved across
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x + 0.5, 5);
      // Downs unchanged
      expect(last.dancers['down_lark_0']).toEqual(init.dancers['down_lark_0']);
      expect(last.dancers['down_robin_0']).toEqual(init.dancers['down_robin_0']);
    });

    it('both lists empty: no movement, 0 beats', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'role',
        listA: [],
        listB: [],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      // Just the initial keyframe (no new keyframes from empty split)
      expect(kfs).toHaveLength(1);
    });

    it('split beats are computed from sub-lists', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'role',
        listA: [
          { id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
          { id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 },
        ],
        listB: [
          { id: tid(12), beats: 8, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 1 },
        ],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('split merges hands from both sub-timelines', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'role',
        listA: [{ id: tid(10), beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'right' }],
        listB: [{ id: tid(11), beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'left' }],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Larks opposite: (up_lark, down_lark) - only larks in scope, opposite has both larks
      expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_lark_0', hb: 'right' });
      // Robins opposite: (up_robin, down_robin) - only robins in scope
      expect(last.hands).toContainEqual({ a: 'up_robin_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
    });

    it('instructions after split continue from merged state', () => {
      const instructions = instr([
        {
          id: tid(1), type: 'split', by: 'role',
          listA: [{ id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
          listB: [{ id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
        },
        { id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Larks stepped up by 1, then across by 0.5
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x + 0.5, 5);
      // Robins stepped down by 1, then across by 0.5
      expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y - 1, 5);
      expect(last.dancers['up_robin_0'].x).toBeCloseTo(init.dancers['up_robin_0'].x - 0.5, 5);
    });

    it('split with allemande in one list and step in the other', () => {
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'position',
        listA: [{ id: tid(10), beats: 8, type: 'allemande', relationship: 'partner', handedness: 'right', rotations: 1 }],
        listB: [{ id: tid(11), beats: 8, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(kfs.length).toBeGreaterThan(2);
      expect(last.beat).toBeCloseTo(8, 5);
      // Ups did a full allemande, should return approximately to start
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 1);
      // Downs stepped up by 1
      expect(last.dancers['down_lark_0'].y).toBeCloseTo(init.dancers['down_lark_0'].y + 1, 5);
      expect(last.dancers['down_robin_0'].y).toBeCloseTo(init.dancers['down_robin_0'].y + 1, 5);
    });
  });

  describe('balance', () => {
    it('dancers end at their starting position after a balance', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'balance', direction: { kind: 'direction', value: 'across' }, distance: 0.2 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Balance: step 0.2 across, then step -0.2 across → net zero
      for (const id of ProtoDancerIdSchema.options) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y, 5);
      }
    });

    it('dancers are displaced at the midpoint of a balance', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'balance', direction: { kind: 'direction', value: 'up' }, distance: 0.2 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      // Find keyframe closest to beat 2 (midpoint)
      const mid = kfs.reduce((best, kf) =>
        Math.abs(kf.beat - 2) < Math.abs(best.beat - 2) ? kf : best
      );
      // At midpoint, dancers should be ~0.2 north of start
      expect(mid.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 0.2, 1);
    });

    it('balance produces multiple keyframes', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'balance', direction: { kind: 'direction', value: 'right' }, distance: 0.2 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('balance beats accumulate correctly', () => {
      const instructions = instr([
        { id: tid(1), beats: 2, type: 'balance', direction: { kind: 'direction', value: 'forward' }, distance: 0.2 },
        { id: tid(2), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(6, 5);
    });
  });

  describe('do_si_do', () => {
    it('dancers return to starting positions after 1 full rotation', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 1);
    });

    it('dancers maintain their original facing throughout', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      // Check mid-animation: facing should stay at initial values
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.dancers['up_lark_0'].facing).toBeCloseTo(init.dancers['up_lark_0'].facing, 1);
      expect(mid.dancers['down_robin_0'].facing).toBeCloseTo(init.dancers['down_robin_0'].facing, 1);
    });

    it('no hand connections during do-si-do', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.hands).toHaveLength(0);
    });

    it('dancers swap positions after half rotation', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'do_si_do', relationship: 'neighbor', rotations: 0.5 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // up_lark (-0.5,-0.5) neighbors down_robin (-0.5,0.5) — half orbit swaps them
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(0.5, 1);
      expect(last.dancers['down_robin_0'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['down_robin_0'].y).toBeCloseTo(-0.5, 1);
    });
  });

  describe('circle', () => {
    it('dancers return to starting positions after full circle', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of ProtoDancerIdSchema.options) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 1);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y, 1);
      }
    });

    it('circle left moves clockwise', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Quarter CW: up_lark (-0.5,-0.5) → (-0.5, 0.5) = down_robin's position
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(0.5, 1);
    });

    it('circle right moves counter-clockwise', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'circle', direction: 'right', rotations: 0.25 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Quarter CCW: up_lark (-0.5,-0.5) → (0.5, -0.5) = up_robin's position
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(0.5, 1);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(-0.5, 1);
    });

    it('dancers face center throughout', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      // Each dancer should face toward center (0,0)
      for (const id of ['up_lark_0', 'up_robin_0', 'down_lark_0', 'down_robin_0'] as const) {
        const d = mid.dancers[id];
        const angleToCenter = ((Math.atan2(-d.x, -d.y) * 180 / Math.PI) % 360 + 360) % 360;
        const facing = ((d.facing % 360) + 360) % 360;
        expect(facing).toBeCloseTo(angleToCenter, 0);
      }
    });

    it('has hand connections forming a ring', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'circle', direction: 'left', rotations: 1 },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      // Should have 4 hand connections (ring of 4 dancers)
      expect(mid.hands).toHaveLength(4);
    });
  });

  describe('pull_by', () => {
    it('dancers swap positions', () => {
      const instructions = instr([
        { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // up_lark (-0.5,-0.5) swaps with neighbor down_robin (-0.5,0.5)
      expect(last.dancers['up_lark_0'].x).toBeCloseTo(init.dancers['down_robin_0'].x, 5);
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['down_robin_0'].y, 5);
      expect(last.dancers['down_robin_0'].x).toBeCloseTo(init.dancers['up_lark_0'].x, 5);
      expect(last.dancers['down_robin_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y, 5);
    });

    it('dancers maintain original facing', () => {
      const instructions = instr([
        { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(init.dancers['up_lark_0'].facing, 5);
      expect(last.dancers['down_robin_0'].facing).toBeCloseTo(init.dancers['down_robin_0'].facing, 5);
    });

    it('has hand connections during the pull-by', () => {
      const instructions = instr([
        { id: tid(1), beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.hands.length).toBeGreaterThan(0);
      expect(mid.hands).toContainEqual({ a: 'up_lark_0', ha: 'right', b: 'down_robin_0', hb: 'right' });
    });
  });

  describe('group', () => {
    it('processes children sequentially', () => {
      const instructions = instr([{
        id: tid(1), type: 'group', label: 'Allemande figure',
        instructions: [
          { id: tid(10), beats: 2, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 },
          { id: tid(11), beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
        ],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      // Should produce keyframes spanning 10 beats total (2 + 8)
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(10, 5);
      expect(kfs.length).toBeGreaterThan(2);
    });

    it('beats accumulate across groups and other instructions', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 0.5 },
        {
          id: tid(2), type: 'group', label: 'My group',
          instructions: [
            { id: tid(20), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 },
          ],
        },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('group can contain a split', () => {
      const instructions = instr([{
        id: tid(1), type: 'group', label: 'Split group',
        instructions: [{
          id: tid(10), type: 'split', by: 'role',
          listA: [{ id: tid(100), beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
          listB: [{ id: tid(101), beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
        }],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark_0'].y).toBeCloseTo(init.dancers['up_lark_0'].y + 1, 5);
      expect(last.dancers['up_robin_0'].y).toBeCloseTo(init.dancers['up_robin_0'].y - 1, 5);
    });

    it('empty group produces no keyframes', () => {
      const instructions = instr([{
        id: tid(1), type: 'group', label: 'Empty',
        instructions: [],
      }]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs).toHaveLength(1); // just the initial keyframe
    });
  });

  describe('swing', () => {
    it('produces multiple keyframes spanning the beat count', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('CoM at the end equals CoM at the beginning', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // up_lark/down_robin pair
      const initCx1 = (init.dancers['up_lark_0'].x + init.dancers['down_robin_0'].x) / 2;
      const initCy1 = (init.dancers['up_lark_0'].y + init.dancers['down_robin_0'].y) / 2;
      const finalCx1 = (last.dancers['up_lark_0'].x + last.dancers['down_robin_0'].x) / 2;
      const finalCy1 = (last.dancers['up_lark_0'].y + last.dancers['down_robin_0'].y) / 2;
      expect(finalCx1).toBeCloseTo(initCx1, 2);
      expect(finalCy1).toBeCloseTo(initCy1, 2);
      // up_robin/down_lark pair
      const initCx2 = (init.dancers['up_robin_0'].x + init.dancers['down_lark_0'].x) / 2;
      const initCy2 = (init.dancers['up_robin_0'].y + init.dancers['down_lark_0'].y) / 2;
      const finalCx2 = (last.dancers['up_robin_0'].x + last.dancers['down_lark_0'].x) / 2;
      const finalCy2 = (last.dancers['up_robin_0'].y + last.dancers['down_lark_0'].y) / 2;
      expect(finalCx2).toBeCloseTo(initCx2, 2);
      expect(finalCy2).toBeCloseTo(initCy2, 2);
    });

    it('during phase 1, the two dancers face opposite directions', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      // Check at beat 4 (midpoint, solidly in phase 1)
      const mid = kfs.reduce((best, kf) =>
        Math.abs(kf.beat - 4) < Math.abs(best.beat - 4) ? kf : best
      );
      // up_lark and down_robin should face opposite directions
      const ulFacing = mid.dancers['up_lark_0'].facing;
      const drFacing = mid.dancers['down_robin_0'].facing;
      const diff1 = ((ulFacing - drFacing + 540) % 360) - 180;
      expect(Math.abs(diff1)).toBeCloseTo(180, 0);
      // up_robin and down_lark should face opposite directions
      const urFacing = mid.dancers['up_robin_0'].facing;
      const dlFacing = mid.dancers['down_lark_0'].facing;
      const diff2 = ((dlFacing - urFacing + 540) % 360) - 180;
      expect(Math.abs(diff2)).toBeCloseTo(180, 0);
    });

    it('at the end, both dancers face the endFacing', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // up_lark (x < 0): across = 90° (east)
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(90, 0);
      expect(last.dancers['down_robin_0'].facing).toBeCloseTo(90, 0);
      // down_lark (x > 0): across = 270° (west)
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(270, 0);
      expect(last.dancers['up_robin_0'].facing).toBeCloseTo(270, 0);
    });

    it('at the end, the robin is 1.0m to the lark\'s right', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // up_lark faces 90° (east), right = south (-y)
      // robin (down_robin) should be 1.0m to lark's right
      const ul = last.dancers['up_lark_0'];
      const dr = last.dancers['down_robin_0'];
      const larkRightX = Math.cos(ul.facing * Math.PI / 180);
      const larkRightY = -Math.sin(ul.facing * Math.PI / 180);
      const dx = dr.x - ul.x;
      const dy = dr.y - ul.y;
      const rightComponent = dx * larkRightX + dy * larkRightY;
      expect(rightComponent).toBeCloseTo(1.0, 1);
      // Forward component should be ~0
      const fwdX = Math.sin(ul.facing * Math.PI / 180);
      const fwdY = Math.cos(ul.facing * Math.PI / 180);
      const fwdComponent = dx * fwdX + dy * fwdY;
      expect(fwdComponent).toBeCloseTo(0.0, 1);
    });

    it('partner swing works with endFacing up', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'partner', endFacing: { kind: 'direction', value: 'up' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Both dancers in each pair should face up (0°)
      expect(last.dancers['up_lark_0'].facing).toBeCloseTo(0, 0);
      expect(last.dancers['up_robin_0'].facing).toBeCloseTo(0, 0);
      expect(last.dancers['down_lark_0'].facing).toBeCloseTo(0, 0);
      expect(last.dancers['down_robin_0'].facing).toBeCloseTo(0, 0);
    });

    it('errors when pairs have the same role', () => {
      // opposite: up_lark ↔ down_lark (both larks)
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'opposite', endFacing: { kind: 'direction', value: 'up' } },
      ]);
      const { error } = generateAllKeyframes(instructions);
      expect(error).not.toBeNull();
      expect(error!.instructionId).toBe(tid(1));
      expect(error!.message).toMatch(/same role/);
    });

    it('orbits clockwise (lark moves westward from initial south-of-CoM position)', () => {
      const instructions = instr([
        { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
      ]);
      const { keyframes: kfs } = generateAllKeyframes(instructions);
      // up_lark starts south of CoM (-0.5, 0). CW from south goes west (decreasing x).
      const early = kfs[2]; // a few frames in
      expect(early.dancers['up_lark_0'].x).toBeLessThan(-0.5);
    });
  });

  describe('validateHandDistances', () => {
    it('no warning when neighbors take hands (distance ~1.0m)', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'left' },
      ]);
      const { keyframes } = generateAllKeyframes(instructions);
      const warnings = validateHandDistances(instructions, keyframes);
      expect(warnings.size).toBe(0);
    });

    it('warns when dancers step apart while holding hands', () => {
      const instructions = instr([
        { id: tid(1), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'left' },
        { id: tid(2), beats: 2, type: 'step', direction: { kind: 'direction', value: 'back' }, distance: 0.4 },
      ]);
      const { keyframes } = generateAllKeyframes(instructions);
      const warnings = validateHandDistances(instructions, keyframes);
      expect(warnings.has(tid(2))).toBe(true);
      expect(warnings.get(tid(2))).toMatch(/Hands too far apart/);
    });

    it('no warning when stepping without hands', () => {
      const instructions = instr([
        { id: tid(1), beats: 2, type: 'step', direction: { kind: 'direction', value: 'back' }, distance: 0.4 },
      ]);
      const { keyframes } = generateAllKeyframes(instructions);
      const warnings = validateHandDistances(instructions, keyframes);
      expect(warnings.size).toBe(0);
    });
  });
});

describe('DanceSchema', () => {
  it('parses a valid dance with improper formation', () => {
    const raw = {
      initFormation: 'improper',
      progression: 1,
      instructions: [
        { id: tid(1), beats: 8, type: 'swing', relationship: 'neighbor', endFacing: { kind: 'direction', value: 'across' } },
      ],
    };
    const dance = DanceSchema.parse(raw);
    expect(dance.initFormation).toBe('improper');
    expect(dance.progression).toBe(1);
    expect(dance.instructions).toHaveLength(1);
  });

  it('parses a valid dance with beckett formation', () => {
    const raw = {
      initFormation: 'beckett',
      progression: 1,
      instructions: [],
    };
    const dance = DanceSchema.parse(raw);
    expect(dance.initFormation).toBe('beckett');
    expect(dance.instructions).toHaveLength(0);
  });

  it('rejects invalid initFormation', () => {
    const raw = {
      initFormation: 'circle',
      instructions: [],
    };
    expect(() => DanceSchema.parse(raw)).toThrow();
  });

  it('rejects missing initFormation', () => {
    const raw = {
      instructions: [],
    };
    expect(() => DanceSchema.parse(raw)).toThrow();
  });

  it('rejects invalid instructions within a dance', () => {
    const raw = {
      initFormation: 'improper',
      instructions: [{ id: tid(1), beats: 8, type: 'nonexistent' }],
    };
    expect(() => DanceSchema.parse(raw)).toThrow();
  });
});

describe('generateAllKeyframes with initFormation', () => {
  it('uses improper formation by default (no initFormation)', () => {
    const { keyframes: kfs } = generateAllKeyframes([]);
    expect(kfs).toHaveLength(1);
    // Improper: ups face north (0), downs face south (180)
    expect(kfs[0].dancers.up_lark_0.facing).toBe(0);
    expect(kfs[0].dancers.down_lark_0.facing).toBe(180);
  });

  it('uses improper formation when initFormation is "improper"', () => {
    const { keyframes: kfs } = generateAllKeyframes([], 'improper');
    expect(kfs).toHaveLength(1);
    expect(kfs[0].dancers.up_lark_0).toEqual({ x: -0.5, y: -0.5, facing: 0 });
    expect(kfs[0].dancers.down_lark_0).toEqual({ x: 0.5, y: 0.5, facing: 180 });
  });

  it('uses beckett formation when initFormation is "beckett"', () => {
    const { keyframes: kfs } = generateAllKeyframes([], 'beckett');
    expect(kfs).toHaveLength(1);
    // Beckett: everyone faces across (east-west) instead of up-down
    // Ups face east (90), downs face west (270)
    expect(kfs[0].dancers.up_lark_0.facing).toBe(90);
    expect(kfs[0].dancers.up_robin_0.facing).toBe(90);
    expect(kfs[0].dancers.down_lark_0.facing).toBe(270);
    expect(kfs[0].dancers.down_robin_0.facing).toBe(270);
  });

  it('beckett formation has correct positions', () => {
    const { keyframes: kfs } = generateAllKeyframes([], 'beckett');
    // Beckett = improper rotated 90° CW: (x,y) -> (y, -x), facing -> facing+90
    expect(kfs[0].dancers.up_lark_0).toEqual({ x: -0.5, y:  0.5, facing: 90 });
    expect(kfs[0].dancers.up_robin_0).toEqual({ x: -0.5, y: -0.5, facing: 90 });
    expect(kfs[0].dancers.down_lark_0).toEqual({ x:  0.5, y: -0.5, facing: 270 });
    expect(kfs[0].dancers.down_robin_0).toEqual({ x:  0.5, y:  0.5, facing: 270 });
  });
});
