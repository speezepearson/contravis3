import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from './generate';
import type { Instruction, Keyframe } from './types';

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
    hands: [],
  };
}

describe('generateAllKeyframes', () => {
  it('returns just the initial keyframe when no instructions', () => {
    const kfs = generateAllKeyframes([]);
    expect(kfs).toHaveLength(1);
    expect(kfs[0].beat).toBe(0);
    expect(kfs[0].dancers).toEqual(initialKeyframe().dancers);
    expect(kfs[0].hands).toEqual([]);
  });

  describe('take_hands', () => {
    it('adds hand connections for neighbor pairs', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
      ];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs).toHaveLength(2);
      const last = kfs[kfs.length - 1];
      expect(last.beat).toBe(0);
      expect(last.hands).toHaveLength(2);
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'right', b: 'down_robin', hb: 'right' });
      expect(last.hands).toContainEqual({ a: 'up_robin', ha: 'right', b: 'down_lark', hb: 'right' });
      expect(last.dancers).toEqual(initialKeyframe().dancers);
    });

    it('adds hand connections for partner pairs', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 2, type: 'take_hands', relationship: 'partner', hand: 'left' },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.beat).toBe(2);
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'left', b: 'up_robin', hb: 'left' });
      expect(last.hands).toContainEqual({ a: 'down_lark', ha: 'left', b: 'down_robin', hb: 'left' });
    });
  });

  describe('drop_hands', () => {
    it('removes hand connections for the relationship', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 0, type: 'drop_hands', relationship: 'neighbor' },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(0);
    });

    it('only removes the specified relationship hands', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: 3, beats: 0, type: 'drop_hands', relationship: 'neighbor' },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(2);
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'left', b: 'up_robin', hb: 'left' });
      expect(last.hands).toContainEqual({ a: 'down_lark', ha: 'left', b: 'down_robin', hb: 'left' });
    });
  });

  describe('turn', () => {
    it('turns dancers to face up (0 degrees)', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'direction', value: 'up' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(0);
      }
    });

    it('turns dancers to face down (180 degrees)', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(180);
      }
    });

    it('turns dancers to face across', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'direction', value: 'across' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(90);
      expect(last.dancers['down_robin'].facing).toBe(90);
      expect(last.dancers['up_robin'].facing).toBe(270);
      expect(last.dancers['down_lark'].facing).toBe(270);
    });

    it('turns dancers to face out', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'direction', value: 'out' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(270);
      expect(last.dancers['down_robin'].facing).toBe(270);
      expect(last.dancers['up_robin'].facing).toBe(90);
      expect(last.dancers['down_lark'].facing).toBe(90);
    });

    it('turns dancers to face progression direction', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'direction', value: 'progression' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(0);
      expect(last.dancers['up_robin'].facing).toBe(0);
      expect(last.dancers['down_lark'].facing).toBe(180);
      expect(last.dancers['down_robin'].facing).toBe(180);
    });

    it('turns dancers to face anti-progression direction', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'direction', value: 'anti-progression' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(180);
      expect(last.dancers['up_robin'].facing).toBe(180);
      expect(last.dancers['down_lark'].facing).toBe(0);
      expect(last.dancers['down_robin'].facing).toBe(0);
    });

    it('rotates dancers clockwise by given degrees from current facing', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'cw', value: 90 } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['up_robin'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_robin'].facing).toBeCloseTo(270, 5);
    });

    it('negative CW degrees means counter-clockwise', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'cw', value: -90 } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(90, 5);
    });

    it('turns selected dancers toward a relationship target', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'turn', target: { kind: 'relationship', value: 'partner' } },
      ];
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
      const instructions: Instruction[] = [
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[0].beat).toBe(0);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('dancers return to approximately their starting positions after 1 full rotation', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 1);
    });

    it('dancers swap positions after half rotation', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(0.5, 1);
      expect(last.dancers['down_robin'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['down_robin'].y).toBeCloseTo(-0.5, 1);
    });

    it('dancers face center during allemande', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 8, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const midIdx = Math.floor(kfs.length / 2);
      const mid = kfs[midIdx];
      const ulFacing = mid.dancers['up_lark'].facing;
      const cx = -0.5, cy = 0;
      const expectedAngle = Math.atan2(cx - mid.dancers['up_lark'].x, cy - mid.dancers['up_lark'].y) * 180 / Math.PI;
      const normalizedExpected = ((expectedAngle % 360) + 360) % 360;
      const normalizedActual = ((ulFacing % 360) + 360) % 360;
      expect(normalizedActual).toBeCloseTo(normalizedExpected, 0);
    });
  });

  describe('step', () => {
    it('moves dancers up by distance', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of Object.keys(init.dancers)) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y + 1, 5);
      }
    });

    it('moves dancers down by distance', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      for (const id of Object.keys(init.dancers)) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y - 0.5, 5);
      }
    });

    it('moves dancers across (toward center of set)', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x - 0.5, 5);
    });

    it('moves dancers out (away from center)', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'out' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x - 0.5, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x + 0.5, 5);
    });

    it('moves dancers CW degrees from their current facing', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'cw', value: 90 }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups face 0°, 90° CW = east (+x); Downs face 180°, 90° CW = west (-x)
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 1, 5);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 5);
      expect(last.dancers['down_lark'].x).toBeCloseTo(init.dancers['down_lark'].x - 1, 5);
    });

    it('CW degrees is relative to each dancers current facing', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'cw', value: 90 }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 1, 5);
      expect(last.dancers['down_lark'].x).toBeCloseTo(init.dancers['down_lark'].x - 1, 5);
    });

    it('moves dancers toward a relationship target', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'relationship', value: 'partner' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x - 0.5, 5);
    });

    it('moves dancers in their progression direction', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['up_robin'].y).toBeCloseTo(init.dancers['up_robin'].y + 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y - 1, 5);
      expect(last.dancers['down_robin'].y).toBeCloseTo(init.dancers['down_robin'].y - 1, 5);
    });

    it('moves dancers in their anti-progression direction', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'anti-progression' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y - 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y + 1, 5);
    });

    it('produces multiple keyframes with easing', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('preserves hands through step', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(2);
    });
  });

  describe('instruction sequencing', () => {
    it('beats accumulate across instructions', () => {
      const instructions: Instruction[] = [
        { id: 1, beats: 4, type: 'turn', target: { kind: 'direction', value: 'up' } },
        { id: 2, beats: 4, type: 'turn', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[0].beat).toBe(0);
      expect(kfs[kfs.length - 1].beat).toBe(8);
    });
  });

  describe('split', () => {
    it('split by role: larks and robins do different things', () => {
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'role',
        listA: [{ id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
        listB: [{ id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
      }];
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
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'position',
        listA: [{ id: 10, beats: 0, type: 'turn', target: { kind: 'direction', value: 'down' } }],
        listB: [{ id: 11, beats: 0, type: 'turn', target: { kind: 'direction', value: 'up' } }],
      }];
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
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'role',
        listA: [],
        listB: [{ id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
      }];
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
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'position',
        listA: [{ id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 }],
        listB: [],
      }];
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
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'role',
        listA: [],
        listB: [],
      }];
      const kfs = generateAllKeyframes(instructions);
      // Just the initial keyframe (no new keyframes from empty split)
      expect(kfs).toHaveLength(1);
    });

    it('split beats are computed from sub-lists', () => {
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'role',
        listA: [
          { id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
          { id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 },
        ],
        listB: [
          { id: 12, beats: 8, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 1 },
        ],
      }];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('split merges hands from both sub-timelines', () => {
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'role',
        listA: [{ id: 10, beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'right' }],
        listB: [{ id: 11, beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'left' }],
      }];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Larks opposite: (up_lark, down_lark) - only larks in scope, opposite has both larks
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'right', b: 'down_lark', hb: 'right' });
      // Robins opposite: (up_robin, down_robin) - only robins in scope
      expect(last.hands).toContainEqual({ a: 'up_robin', ha: 'left', b: 'down_robin', hb: 'left' });
    });

    it('instructions after split continue from merged state', () => {
      const instructions: Instruction[] = [
        {
          id: 1, type: 'split', by: 'role',
          listA: [{ id: 10, beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
          listB: [{ id: 11, beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 1 }],
        },
        { id: 2, beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
      ];
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
      const instructions: Instruction[] = [{
        id: 1, type: 'split', by: 'position',
        listA: [{ id: 10, beats: 8, type: 'allemande', relationship: 'partner', direction: 'cw', rotations: 1 }],
        listB: [{ id: 11, beats: 8, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 }],
      }];
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
});
