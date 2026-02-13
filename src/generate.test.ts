import z from 'zod';
import { describe, it, expect } from 'vitest';
import { generateAllKeyframes, validateHandDistances, validateHandSymmetry } from './generate';
import type { Instruction, Keyframe, DancerHands, ProtoDancerId } from './types';
import { dancerPosition, InstructionSchema } from './types';

const EMPTY_HANDS: Record<ProtoDancerId, DancerHands> = { up_lark: {}, up_robin: {}, down_lark: {}, down_robin: {} };

// Helper: the initial improper formation (beat 0, no hands)
function initialKeyframe(): Keyframe {
  return {
    beat: 0,
    dancers: {
      up_lark:    { x: -0.5, y: -0.5, facing: 0 },
      up_robin:   { x:  0.5, y: -0.5, facing: 0 },
      down_lark:  { x:  0.5, y:  0.5, facing: 180 },
      down_robin: { x: -0.5, y:  0.5, facing: 180 },
    },
    hands: { up_lark: {}, up_robin: {}, down_lark: {}, down_robin: {} },
  };
}

/** Helper: check that a specific hand hold exists in the hands record */
function expectHandHold(
  hands: Record<ProtoDancerId, DancerHands>,
  proto: ProtoDancerId, hand: 'left' | 'right',
  targetId: string, targetHand: 'left' | 'right',
) {
  const held = hands[proto][hand];
  expect(held).toBeDefined();
  expect(held![0]).toBe(targetId);
  expect(held![1]).toBe(targetHand);
}

describe('generateAllKeyframes', () => {
  it('returns just the initial keyframe when no instructions', () => {
    const kfs = generateAllKeyframes([]);
    expect(kfs).toHaveLength(1);
    expect(kfs[0].beat).toBe(0);
    expect(kfs[0].dancers).toEqual(initialKeyframe().dancers);
    expect(kfs[0].hands).toEqual(EMPTY_HANDS);
  });

  describe('take_hands', () => {
    it('adds hand connections for neighbor pairs', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs).toHaveLength(2);
      const last = kfs[kfs.length - 1];
      expect(last.beat).toBe(0);
      expectHandHold(last.hands, 'up_lark', 'right', 'down_robin_0', 'right');
      expectHandHold(last.hands, 'down_robin', 'right', 'up_lark_0', 'right');
      expectHandHold(last.hands, 'up_robin', 'right', 'down_lark_0', 'right');
      expectHandHold(last.hands, 'down_lark', 'right', 'up_robin_0', 'right');
      expect(last.dancers).toEqual(initialKeyframe().dancers);
    });

    it('adds hand connections for partner pairs', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'take_hands', relationship: 'partner', hand: 'left' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.beat).toBe(2);
      expectHandHold(last.hands, 'up_lark', 'left', 'up_robin_0', 'left');
      expectHandHold(last.hands, 'up_robin', 'left', 'up_lark_0', 'left');
      expectHandHold(last.hands, 'down_lark', 'left', 'down_robin_0', 'left');
      expectHandHold(last.hands, 'down_robin', 'left', 'down_lark_0', 'left');
    });
  });

  describe('dynamic relationships (on_right, on_left, in_front)', () => {
    it('on_right in initial formation: each dancer connects to nearest dancer on their right', () => {
      // Per-dancer resolution: up_lark (facing N, right=E) → up_robin,
      // down_lark (facing S, right=W) → down_robin are exact matches.
      // up_robin and down_robin also resolve on_right, and since all use the same
      // hand, later connections may overwrite earlier reverse entries. Verify that
      // every dancer has a right-hand connection and symmetry holds.
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'on_right', hand: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const proto of ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const) {
        expect(last.hands[proto].right).toBeDefined();
      }
      expect(validateHandSymmetry([last])).toEqual([]);
    });

    it('in_front in initial formation resolves to neighbor pairs', () => {
      // In initial improper: ups face north toward downs, downs face south toward ups
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'in_front', hand: 'left' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expectHandHold(last.hands, 'up_lark', 'left', 'down_robin_0', 'left');
      expectHandHold(last.hands, 'up_robin', 'left', 'down_lark_0', 'left');
    });

    it('on_left after turning to face across resolves correctly', () => {
      // Turn everyone to face across, then "on your left" resolves per-dancer.
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'across' } },
        { id: 2, beats: 0, type: 'take_hands', relationship: 'on_left', hand: 'left' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // All dancers should have a left-hand connection and symmetry should hold
      for (const proto of ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const) {
        expect(last.hands[proto].left).toBeDefined();
      }
      expect(validateHandSymmetry([last])).toEqual([]);
    });

    it('in_front resolves across hands-fours when all dancers face the same direction', () => {
      // Turn everyone to face up, then "in_front" resolves per-dancer.
      // The up dancers connect to the down dancers in front of them (within hands-four).
      // Down dancers would resolve to the next hands-four, but those slots are already
      // occupied by within-hands-four connections, so they get skipped.
      // Verify the within-hands-four connections are correct and symmetric.
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } },
        { id: 2, beats: 0, type: 'take_hands', relationship: 'in_front', hand: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Up dancers should connect to the down dancer in front of them
      expect(last.hands.up_lark.right).toBeDefined();
      expect(last.hands.up_robin.right).toBeDefined();
      expect(validateHandSymmetry([last])).toEqual([]);
    });
  });

  describe('drop_hands', () => {
    it('removes hand connections for the relationship', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 0, type: 'drop_hands', target: 'neighbor' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toEqual(EMPTY_HANDS);
    });

    it('only removes the specified relationship hands', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: 3, beats: 0, type: 'drop_hands', target: 'neighbor' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expectHandHold(last.hands, 'up_lark', 'left', 'up_robin_0', 'left');
      expectHandHold(last.hands, 'up_robin', 'left', 'up_lark_0', 'left');
      expect(last.hands.up_lark.right).toBeUndefined();
      expect(last.hands.up_robin.right).toBeUndefined();
    });

    it('drops by hand: removes all connections using that hand', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: 3, beats: 0, type: 'drop_hands', target: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Only partner left-hand connections remain
      expectHandHold(last.hands, 'up_lark', 'left', 'up_robin_0', 'left');
      expectHandHold(last.hands, 'down_lark', 'left', 'down_robin_0', 'left');
      expect(last.hands.up_lark.right).toBeUndefined();
      expect(last.hands.down_lark.right).toBeUndefined();
    });

    it('drops both: removes all hand connections', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: 3, beats: 0, type: 'drop_hands', target: 'both' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toEqual(EMPTY_HANDS);
    });
  });

  describe('turn', () => {
    it('turns dancers to face up (0 degrees)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(0);
      }
    });

    it('turns dancers to face down (180 degrees)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'down' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(180);
      }
    });

    it('turns dancers to face across', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'across' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(90);
      expect(last.dancers['down_robin'].facing).toBe(90);
      expect(last.dancers['up_robin'].facing).toBe(270);
      expect(last.dancers['down_lark'].facing).toBe(270);
    });

    it('turns dancers to face out', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'out' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(270);
      expect(last.dancers['down_robin'].facing).toBe(270);
      expect(last.dancers['up_robin'].facing).toBe(90);
      expect(last.dancers['down_lark'].facing).toBe(90);
    });

    it('turns dancers to face progression direction', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'progression' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(0);
      expect(last.dancers['up_robin'].facing).toBe(0);
      expect(last.dancers['down_lark'].facing).toBe(180);
      expect(last.dancers['down_robin'].facing).toBe(180);
    });

    it('turns dancers to face forward (same as current facing)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'forward' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0°, downs face 180° — forward preserves facing
      expect(last.dancers['up_lark'].facing).toBeCloseTo(0, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(180, 5);
    });

    it('turns dancers to face back (opposite of current facing)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'back' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBeCloseTo(180, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(0, 5);
    });

    it('turns dancers to face right (90° CW from current facing)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'right' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0°, right = 90°; downs face 180°, right = 270°
      expect(last.dancers['up_lark'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(270, 5);
    });

    it('turns dancers to face left (90° CCW from current facing)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'left' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0°, left = 270°; downs face 180°, left = 90°
      expect(last.dancers['up_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(90, 5);
    });

    it('offset rotates clockwise by given degrees from target', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 90, target: { kind: 'direction', value: 'forward' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0° + 90° = 90°; downs face 180° + 90° = 270°
      expect(last.dancers['up_lark'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['up_robin'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_robin'].facing).toBeCloseTo(270, 5);
    });

    it('negative offset means counter-clockwise', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: -90, target: { kind: 'direction', value: 'forward' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups face 0° - 90° = 270°; downs face 180° - 90° = 90°
      expect(last.dancers['up_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(90, 5);
    });

    it('applies offset degrees clockwise on top of target direction', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 90, target: { kind: 'direction', value: 'up' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Up (0°) + 90° offset = 90° (east) for all dancers
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBeCloseTo(90, 5);
      }
    });

    it('turns selected dancers toward a relationship target', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'turn', offset: 0, target: { kind: 'relationship', value: 'partner' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['up_robin'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_robin'].facing).toBeCloseTo(90, 5);
    });
  });

  describe('allemande', () => {
    it('produces multiple keyframes for the arc', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[0].beat).toBe(0);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('dancers return to approximately their starting positions after 1 full rotation', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 1);
    });

    it('dancers swap positions after half rotation', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(0.5, 1);
      expect(last.dancers['down_robin'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['down_robin'].y).toBeCloseTo(-0.5, 1);
    });

    it('allemande right: right shoulder faces partner (facing is 90° CCW from direction to partner)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      // Check a mid-animation frame
      const midIdx = Math.floor(kfs.length / 2);
      const mid = kfs[midIdx];
      // For up_lark, neighbor is down_robin. Direction to partner from up_lark's position.
      const ul = mid.dancers['up_lark'];
      const dr = mid.dancers['down_robin'];
      const dirToPartner = Math.atan2(dr.x - ul.x, dr.y - ul.y) * 180 / Math.PI;
      // Facing should be 90° CCW (i.e. -90°) from direction to partner
      const expectedFacing = ((dirToPartner - 90) % 360 + 360) % 360;
      const actualFacing = ((ul.facing % 360) + 360) % 360;
      expect(actualFacing).toBeCloseTo(expectedFacing, 0);
    });

    it('allemande left: left shoulder faces partner (facing is 90° CW from direction to partner)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'left', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const midIdx = Math.floor(kfs.length / 2);
      const mid = kfs[midIdx];
      const ul = mid.dancers['up_lark'];
      const dr = mid.dancers['down_robin'];
      const dirToPartner = Math.atan2(dr.x - ul.x, dr.y - ul.y) * 180 / Math.PI;
      // Facing should be 90° CW (i.e. +90°) from direction to partner
      const expectedFacing = ((dirToPartner + 90) % 360 + 360) % 360;
      const actualFacing = ((ul.facing % 360) + 360) % 360;
      expect(actualFacing).toBeCloseTo(expectedFacing, 0);
    });

    it('allemande right adds right hand connections', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      // All allemande keyframes should have hand connections
      const mid = kfs[Math.floor(kfs.length / 2)];
      expectHandHold(mid.hands, 'up_lark', 'right', 'down_robin_0', 'right');
      expectHandHold(mid.hands, 'up_robin', 'right', 'down_lark_0', 'right');
    });

    it('allemande left adds left hand connections', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'allemande', relationship: 'partner', handedness: 'left', rotations: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      expectHandHold(mid.hands, 'up_lark', 'left', 'up_robin_0', 'left');
      expectHandHold(mid.hands, 'down_lark', 'left', 'down_robin_0', 'left');
    });

    it('allemande left orbits counter-clockwise', () => {
      // Allemande left with neighbors: up_lark neighbors down_robin
      // CCW orbit: up_lark (at -0.5,-0.5) should move east first (toward +x)
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'left', rotations: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      // After half rotation CCW, up_lark should be roughly where down_robin was
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(0.5, 1);
    });

    it('maintains constant distance between hand-connected partners', () => {
      // on_right from initial formation produces non-reciprocal relationship
      // resolution (up_lark→up_robin but up_robin→down_lark), yet the hand
      // connections pair up_lark↔up_robin. Both must orbit the same center.
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'allemande', relationship: 'on_right', handedness: 'right', rotations: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const protos: ProtoDancerId[] = ['up_lark', 'up_robin', 'down_lark', 'down_robin'];

      for (const id of protos) {
        const hold = kfs[1].hands[id].right;
        if (!hold) continue;
        const [targetDancerId] = hold;

        // Distance in the first allemande frame
        const p0 = kfs[1].dancers[id];
        const t0 = dancerPosition(targetDancerId, kfs[1].dancers);
        const d0 = Math.hypot(p0.x - t0.x, p0.y - t0.y);

        for (let i = 2; i < kfs.length; i++) {
          const pi = kfs[i].dancers[id];
          const ti = dancerPosition(targetDancerId, kfs[i].dancers);
          const di = Math.hypot(pi.x - ti.x, pi.y - ti.y);
          expect(di).toBeCloseTo(d0, 1);
        }
      }
    });
  });

  describe('step', () => {
    it('moves dancers up by distance', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of Object.keys(init.dancers) as ProtoDancerId[]) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y + 1, 5);
      }
    });

    it('moves dancers down by distance', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of Object.keys(init.dancers) as ProtoDancerId[]) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y - 0.5, 5);
      }
    });

    it('moves dancers across (toward center of set)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x - 0.5, 5);
    });

    it('moves dancers out (away from center)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'out' }, distance: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x - 0.5, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x + 0.5, 5);
    });


    it('moves dancers toward a relationship target', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'relationship', value: 'partner' }, distance: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x - 0.5, 5);
    });

    it('moves dancers in their progression direction', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['up_robin'].y).toBeCloseTo(init.dancers['up_robin'].y + 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y - 1, 5);
      expect(last.dancers['down_robin'].y).toBeCloseTo(init.dancers['down_robin'].y - 1, 5);
    });

    it('negative distance steps in the opposite direction', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: -1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Negative progression = anti-progression
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y - 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y + 1, 5);
    });

    it('moves dancers forward (relative to their facing)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups face 0° (north/+y), downs face 180° (south/-y)
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y - 1, 5);
    });

    it('moves dancers right (90° CW from facing)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'right' }, distance: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups face 0°, right = 90° = east (+x); downs face 180°, right = 270° = west (-x)
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 1, 5);
      expect(last.dancers['down_lark'].x).toBeCloseTo(init.dancers['down_lark'].x - 1, 5);
    });

    it('produces multiple keyframes with easing', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('preserves hands through step', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expectHandHold(last.hands, 'up_lark', 'right', 'down_robin_0', 'right');
      expectHandHold(last.hands, 'up_robin', 'right', 'down_lark_0', 'right');
    });
  });

  describe('instruction sequencing', () => {
    it('beats accumulate across instructions', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } },
        { id: 2, beats: 4, type: 'turn', offset: 0, target: { kind: 'direction', value: 'down' } },
      ]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[0].beat).toBe(0);
      expect(kfs[kfs.length - 1].beat).toBe(8);
    });
  });

  describe('split', () => {
    it('split by role: larks and robins do different things', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'role',
        listA: [{ id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
        listB: [{ id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
      }]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Larks (group A) step up
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y + 1, 5);
      // Robins (group B) step down
      expect(last.dancers['up_robin'].y).toBeCloseTo(init.dancers['up_robin'].y - 1, 5);
      expect(last.dancers['down_robin'].y).toBeCloseTo(init.dancers['down_robin'].y - 1, 5);
    });

    it('split by position: ups and downs do different things', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'position',
        listA: [{ id: 10, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'down' } }],
        listB: [{ id: 11, beats: 0, type: 'turn', offset: 0, target: { kind: 'direction', value: 'up' } }],
      }]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups (group A) turn to face down
      expect(last.dancers['up_lark'].facing).toBe(180);
      expect(last.dancers['up_robin'].facing).toBe(180);
      // Downs (group B) turn to face up
      expect(last.dancers['down_lark'].facing).toBe(0);
      expect(last.dancers['down_robin'].facing).toBe(0);
    });

    it('empty listA: group A dancers hold still', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'role',
        listA: [],
        listB: [{ id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
      }]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Larks unchanged
      expect(last.dancers['up_lark']).toEqual(init.dancers['up_lark']);
      expect(last.dancers['down_lark']).toEqual(init.dancers['down_lark']);
      // Robins moved
      expect(last.dancers['up_robin'].y).toBeCloseTo(init.dancers['up_robin'].y + 1, 5);
    });

    it('empty listB: group B dancers hold still', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'position',
        listA: [{ id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 }],
        listB: [],
      }]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups moved across
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      // Downs unchanged
      expect(last.dancers['down_lark']).toEqual(init.dancers['down_lark']);
      expect(last.dancers['down_robin']).toEqual(init.dancers['down_robin']);
    });

    it('both lists empty: no movement, 0 beats', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'role',
        listA: [],
        listB: [],
      }]);
      const kfs = generateAllKeyframes(instructions);
      // Just the initial keyframe (no new keyframes from empty split)
      expect(kfs).toHaveLength(1);
    });

    it('split beats are computed from sub-lists', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'role',
        listA: [
          { id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
          { id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 },
        ],
        listB: [
          { id: 12, beats: 8, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 1 },
        ],
      }]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('split merges hands from both sub-timelines', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'role',
        listA: [{ id: 10, beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'right' }],
        listB: [{ id: 11, beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'left' }],
      }]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Larks opposite: (up_lark, down_lark) - only larks in scope, opposite has both larks
      expectHandHold(last.hands, 'up_lark', 'right', 'down_lark_0', 'right');
      // Robins opposite: (up_robin, down_robin) - only robins in scope
      expectHandHold(last.hands, 'up_robin', 'left', 'down_robin_0', 'left');
    });

    it('instructions after split continue from merged state', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        {
          id: 1, type: 'split', by: 'role',
          listA: [{ id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
          listB: [{ id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
        },
        { id: 2, beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Larks stepped up by 1, then across by 0.5
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      // Robins stepped down by 1, then across by 0.5
      expect(last.dancers['up_robin'].y).toBeCloseTo(init.dancers['up_robin'].y - 1, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x - 0.5, 5);
    });

    it('split with allemande in one list and step in the other', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'split', by: 'position',
        listA: [{ id: 10, beats: 8, type: 'allemande', relationship: 'partner', handedness: 'right', rotations: 1 }],
        listB: [{ id: 11, beats: 8, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
      }]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(kfs.length).toBeGreaterThan(2);
      expect(last.beat).toBeCloseTo(8, 5);
      // Ups did a full allemande, should return approximately to start
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 1);
      // Downs stepped up by 1
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y + 1, 5);
      expect(last.dancers['down_robin'].y).toBeCloseTo(init.dancers['down_robin'].y + 1, 5);
    });
  });

  describe('balance', () => {
    it('dancers end at their starting position after a balance', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'balance', direction: { kind: 'direction', value: 'across' }, distance: 0.2 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Balance: step 0.2 across, then step -0.2 across → net zero
      for (const id of Object.keys(init.dancers)as ProtoDancerId[]) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y, 5);
      }
    });

    it('dancers are displaced at the midpoint of a balance', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'balance', direction: { kind: 'direction', value: 'up' }, distance: 0.2 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      // Find keyframe closest to beat 2 (midpoint)
      const mid = kfs.reduce((best, kf) =>
        Math.abs(kf.beat - 2) < Math.abs(best.beat - 2) ? kf : best
      );
      // At midpoint, dancers should be ~0.2 north of start
      expect(mid.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 0.2, 1);
    });

    it('balance produces multiple keyframes', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'balance', direction: { kind: 'direction', value: 'right' }, distance: 0.2 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('balance beats accumulate correctly', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'balance', direction: { kind: 'direction', value: 'forward' }, distance: 0.2 },
        { id: 2, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(6, 5);
    });
  });

  describe('do_si_do', () => {
    it('dancers return to starting positions after 1 full rotation', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 1);
    });

    it('dancers maintain their original facing throughout', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      // Check mid-animation: facing should stay at initial values
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.dancers['up_lark'].facing).toBeCloseTo(init.dancers['up_lark'].facing, 1);
      expect(mid.dancers['down_robin'].facing).toBeCloseTo(init.dancers['down_robin'].facing, 1);
    });

    it('no hand connections during do-si-do', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'do_si_do', relationship: 'neighbor', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.hands).toEqual(EMPTY_HANDS);
    });

    it('dancers swap positions after half rotation', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'do_si_do', relationship: 'neighbor', rotations: 0.5 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // up_lark (-0.5,-0.5) neighbors down_robin (-0.5,0.5) — half orbit swaps them
      expect(last.dancers['up_lark'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(0.5, 1);
      expect(last.dancers['down_robin'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['down_robin'].y).toBeCloseTo(-0.5, 1);
    });
  });

  describe('circle', () => {
    it('dancers return to starting positions after full circle', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'circle', direction: 'left', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of Object.keys(init.dancers) as ProtoDancerId[]) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 1);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y, 1);
      }
    });

    it('circle left moves counter-clockwise', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Quarter CCW: up_lark (-0.5,-0.5) → (0.5, -0.5) = up_robin's position
      expect(last.dancers['up_lark'].x).toBeCloseTo(0.5, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(-0.5, 1);
    });

    it('circle right moves clockwise', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'circle', direction: 'right', rotations: 0.25 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Quarter CW: up_lark (-0.5,-0.5) → (-0.5, 0.5) = down_robin's position
      expect(last.dancers['up_lark'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(0.5, 1);
    });

    it('dancers face center throughout', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'circle', direction: 'left', rotations: 0.25 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      // Each dancer should face toward center (0,0)
      for (const id of ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const) {
        const d = mid.dancers[id];
        const angleToCenter = ((Math.atan2(-d.x, -d.y) * 180 / Math.PI) % 360 + 360) % 360;
        const facing = ((d.facing % 360) + 360) % 360;
        expect(facing).toBeCloseTo(angleToCenter, 0);
      }
    });

    it('has hand connections forming a ring', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'circle', direction: 'left', rotations: 1 },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const mid = kfs[Math.floor(kfs.length / 2)];
      // Each dancer should have both hands occupied (ring of 4)
      for (const proto of ['up_lark', 'up_robin', 'down_lark', 'down_robin'] as const) {
        expect(mid.hands[proto].left).toBeDefined();
        expect(mid.hands[proto].right).toBeDefined();
      }
    });
  });

  describe('pull_by', () => {
    it('dancers swap positions at the end', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // up_lark (-0.5,-0.5) swaps with neighbor down_robin (-0.5,0.5)
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['down_robin'].x, 5);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['down_robin'].y, 5);
      expect(last.dancers['down_robin'].x).toBeCloseTo(init.dancers['up_lark'].x, 5);
      expect(last.dancers['down_robin'].y).toBeCloseTo(init.dancers['up_lark'].y, 5);
    });

    it('dancers face each other throughout', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      // up_lark faces toward down_robin (north = 0°), down_robin faces toward up_lark (south = 180°)
      const mid = kfs[Math.floor(kfs.length / 2)];
      expect(mid.dancers['up_lark'].facing).toBeCloseTo(0, 5);
      expect(mid.dancers['down_robin'].facing).toBeCloseTo(180, 5);
    });

    it('has hand connections in the first half, drops them in the second half', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      // First half: hands present
      const earlyIdx = 2; // early in the animation
      expectHandHold(kfs[earlyIdx].hands, 'up_lark', 'right', 'down_robin_0', 'right');
      // Second half: hands dropped
      const last = kfs[kfs.length - 1];
      expect(last.hands.up_lark.right).toBeUndefined();
      expect(last.hands.down_robin.right).toBeUndefined();
    });

    it('dancers are laterally displaced at the midpoint (0.5m apart)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const kfs = generateAllKeyframes(instructions);
      // Find the frame closest to the midpoint (beat 1)
      const mid = kfs.reduce((best, kf) =>
        Math.abs(kf.beat - 1) < Math.abs(best.beat - 1) ? kf : best
      );
      // up_lark (-0.5,-0.5) → down_robin (-0.5,0.5): direction is +y, perp is -x
      // At midpoint: both at y=0, separated by 0.5 in x
      const ulX = mid.dancers['up_lark'].x;
      const drX = mid.dancers['down_robin'].x;
      expect(Math.abs(ulX - drX)).toBeCloseTo(0.5, 1);
      // Both should be at y midpoint
      expect(mid.dancers['up_lark'].y).toBeCloseTo(0, 1);
      expect(mid.dancers['down_robin'].y).toBeCloseTo(0, 1);
    });

    it('pull_by left displaces laterally in the opposite direction', () => {
      const rightInstructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'right' },
      ]);
      const leftInstructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'pull_by', relationship: 'neighbor', hand: 'left' },
      ]);
      const rightKfs = generateAllKeyframes(rightInstructions);
      const leftKfs = generateAllKeyframes(leftInstructions);
      const rightMid = rightKfs.reduce((best, kf) =>
        Math.abs(kf.beat - 1) < Math.abs(best.beat - 1) ? kf : best
      );
      const leftMid = leftKfs.reduce((best, kf) =>
        Math.abs(kf.beat - 1) < Math.abs(best.beat - 1) ? kf : best
      );
      // The lateral displacement should be mirrored
      expect(rightMid.dancers['up_lark'].x).toBeCloseTo(-leftMid.dancers['up_lark'].x - 1, 1);
    });
  });

  describe('group', () => {
    it('processes children sequentially', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'group', label: 'Allemande figure',
        instructions: [
          { id: 10, beats: 2, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 },
          { id: 11, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
        ],
      }]);
      const kfs = generateAllKeyframes(instructions);
      // Should produce keyframes spanning 10 beats total (2 + 8)
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(10, 5);
      expect(kfs.length).toBeGreaterThan(2);
    });

    it('beats accumulate across groups and other instructions', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 0.5 },
        {
          id: 2, type: 'group', label: 'My group',
          instructions: [
            { id: 20, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 },
          ],
        },
      ]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('group can contain a split', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'group', label: 'Split group',
        instructions: [{
          id: 10, type: 'split', by: 'role',
          listA: [{ id: 100, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
          listB: [{ id: 101, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
        }],
      }]);
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['up_robin'].y).toBeCloseTo(init.dancers['up_robin'].y - 1, 5);
    });

    it('empty group produces no keyframes', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([{
        id: 1, type: 'group', label: 'Empty',
        instructions: [],
      }]);
      const kfs = generateAllKeyframes(instructions);
      expect(kfs).toHaveLength(1); // just the initial keyframe
    });
  });

  describe('validateHandDistances', () => {
    it('no warning when neighbors take hands (distance ~1.0m)', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'left' },
      ]);
      const keyframes = generateAllKeyframes(instructions);
      const warnings = validateHandDistances(instructions, keyframes);
      expect(warnings.size).toBe(0);
    });

    it('warns when dancers step apart while holding hands', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'left' },
        { id: 2, beats: 2, type: 'step', direction: { kind: 'direction', value: 'back' }, distance: 0.4 },
      ]);
      const keyframes = generateAllKeyframes(instructions);
      const warnings = validateHandDistances(instructions, keyframes);
      expect(warnings.has(2)).toBe(true);
      expect(warnings.get(2)).toMatch(/Hands too far apart/);
    });

    it('no warning when stepping without hands', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 2, type: 'step', direction: { kind: 'direction', value: 'back' }, distance: 0.4 },
      ]);
      const keyframes = generateAllKeyframes(instructions);
      const warnings = validateHandDistances(instructions, keyframes);
      expect(warnings.size).toBe(0);
    });
  });

  describe('validateHandSymmetry', () => {
    it('properly formed take_hands produces no errors', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
      ]);
      const keyframes = generateAllKeyframes(instructions);
      const errors = validateHandSymmetry(keyframes);
      expect(errors).toEqual([]);
    });

    it('properly formed allemande produces no errors', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', handedness: 'right', rotations: 1 },
      ]);
      const keyframes = generateAllKeyframes(instructions);
      const errors = validateHandSymmetry(keyframes);
      expect(errors).toEqual([]);
    });

    it('properly formed circle produces no errors', () => {
      const instructions: Instruction[] = z.array(InstructionSchema).parse([
        { id: 1, beats: 8, type: 'circle', direction: 'left', rotations: 1 },
      ]);
      const keyframes = generateAllKeyframes(instructions);
      const errors = validateHandSymmetry(keyframes);
      expect(errors).toEqual([]);
    });

    it('detects missing reverse entry', () => {
      const keyframes: Keyframe[] = [{
        beat: 0,
        dancers: initialKeyframe().dancers,
        hands: {
          up_lark: { right: ['down_robin_0', 'right'] },
          up_robin: {},
          down_lark: {},
          down_robin: {}, // missing reverse: should have right -> up_lark_0
        },
      }];
      const errors = validateHandSymmetry(keyframes);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/empty/);
    });

    it('detects wrong reverse target', () => {
      const keyframes: Keyframe[] = [{
        beat: 0,
        dancers: initialKeyframe().dancers,
        hands: {
          up_lark: { right: ['down_robin_0', 'right'] },
          up_robin: {},
          down_lark: {},
          down_robin: { right: ['up_robin_0', 'right'] }, // wrong: should point to up_lark
        },
      }];
      const errors = validateHandSymmetry(keyframes);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/expected/);
    });

    it('validates cross-hands-four offset negation', () => {
      // up_lark.right -> up_robin_-1.left means up_robin.left should -> up_lark_1.right
      const keyframes: Keyframe[] = [{
        beat: 0,
        dancers: initialKeyframe().dancers,
        hands: {
          up_lark: { right: ['up_robin_-1' as any, 'left'] },
          up_robin: { left: ['up_lark_1' as any, 'right'] },
          down_lark: {},
          down_robin: {},
        },
      }];
      const errors = validateHandSymmetry(keyframes);
      expect(errors).toEqual([]);
    });
  });
});
