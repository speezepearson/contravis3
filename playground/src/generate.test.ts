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
        { id: 1, selector: 'everyone', beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
      ];
      const kfs = generateAllKeyframes(instructions);
      // Initial + 1 instruction = 2 keyframes
      expect(kfs).toHaveLength(2);
      const last = kfs[kfs.length - 1];
      expect(last.beat).toBe(0);
      // Neighbor pairs: (up_lark, down_robin), (up_robin, down_lark)
      expect(last.hands).toHaveLength(2);
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'right', b: 'down_robin', hb: 'right' });
      expect(last.hands).toContainEqual({ a: 'up_robin', ha: 'right', b: 'down_lark', hb: 'right' });
      // Positions unchanged
      expect(last.dancers).toEqual(initialKeyframe().dancers);
    });

    it('adds hand connections for partner pairs', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 2, type: 'take_hands', relationship: 'partner', hand: 'left' },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.beat).toBe(2);
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'left', b: 'up_robin', hb: 'left' });
      expect(last.hands).toContainEqual({ a: 'down_lark', ha: 'left', b: 'down_robin', hb: 'left' });
    });

    it('filters by selector (larks only)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'larks', beats: 0, type: 'take_hands', relationship: 'opposite', hand: 'right' },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Opposite pairs: (up_lark, down_lark), (up_robin, down_robin)
      // But only larks selected → only the pair that involves both larks
      expect(last.hands).toHaveLength(1);
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'right', b: 'down_lark', hb: 'right' });
    });
  });

  describe('drop_hands', () => {
    it('removes hand connections for the relationship', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, selector: 'everyone', beats: 0, type: 'drop_hands', relationship: 'neighbor' },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(0);
    });

    it('only removes the specified relationship hands', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, selector: 'everyone', beats: 0, type: 'take_hands', relationship: 'partner', hand: 'left' },
        { id: 3, selector: 'everyone', beats: 0, type: 'drop_hands', relationship: 'neighbor' },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Only partner hands remain
      expect(last.hands).toHaveLength(2);
      expect(last.hands).toContainEqual({ a: 'up_lark', ha: 'left', b: 'up_robin', hb: 'left' });
      expect(last.hands).toContainEqual({ a: 'down_lark', ha: 'left', b: 'down_robin', hb: 'left' });
    });
  });

  describe('turn', () => {
    it('turns dancers to face up (0 degrees)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'direction', value: 'up' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(0);
      }
    });

    it('turns dancers to face down (180 degrees)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(180);
      }
    });

    it('turns dancers to face across', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'direction', value: 'across' } },
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
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'direction', value: 'out' } },
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
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'direction', value: 'progression' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups progress north (0°), downs progress south (180°)
      expect(last.dancers['up_lark'].facing).toBe(0);
      expect(last.dancers['up_robin'].facing).toBe(0);
      expect(last.dancers['down_lark'].facing).toBe(180);
      expect(last.dancers['down_robin'].facing).toBe(180);
    });

    it('turns dancers to face anti-progression direction', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'direction', value: 'anti-progression' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Opposite of progression
      expect(last.dancers['up_lark'].facing).toBe(180);
      expect(last.dancers['up_robin'].facing).toBe(180);
      expect(last.dancers['down_lark'].facing).toBe(0);
      expect(last.dancers['down_robin'].facing).toBe(0);
    });

    it('rotates dancers clockwise by given degrees from current facing', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'cw', value: 90 } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups start facing 0°, +90 CW → 90°
      expect(last.dancers['up_lark'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['up_robin'].facing).toBeCloseTo(90, 5);
      // Downs start facing 180°, +90 CW → 270°
      expect(last.dancers['down_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_robin'].facing).toBeCloseTo(270, 5);
    });

    it('negative CW degrees means counter-clockwise', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'cw', value: -90 } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // Ups start facing 0°, -90 CW → 270°
      expect(last.dancers['up_lark'].facing).toBeCloseTo(270, 5);
      // Downs start facing 180°, -90 CW → 90°
      expect(last.dancers['down_lark'].facing).toBeCloseTo(90, 5);
    });

    it('turns selected dancers toward a relationship target', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'turn', target: { kind: 'relationship', value: 'partner' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBeCloseTo(90, 5);
      expect(last.dancers['up_robin'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_lark'].facing).toBeCloseTo(270, 5);
      expect(last.dancers['down_robin'].facing).toBeCloseTo(90, 5);
    });

    it('only affects selected dancers', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'ups', beats: 0, type: 'turn', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].facing).toBe(180);
      expect(last.dancers['up_robin'].facing).toBe(180);
      expect(last.dancers['down_lark'].facing).toBe(180);
      expect(last.dancers['down_robin'].facing).toBe(180);
    });
  });

  describe('allemande', () => {
    it('produces multiple keyframes for the arc', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 8, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      // Initial + n_frames+1 for 8 beats at 0.25 step = 1 + 33
      expect(kfs.length).toBeGreaterThan(2);
      // First keyframe is initial
      expect(kfs[0].beat).toBe(0);
      // Last keyframe is at beat 8
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(8, 5);
    });

    it('dancers return to approximately their starting positions after 1 full rotation', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 8, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];

      // After full rotation, neighbor pairs should swap positions
      // up_lark(-0.5,-0.5) orbits with down_robin(-0.5,0.5) around center (-0.5, 0)
      // After 1 full CW rotation (360°), they should return to start
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 1);
    });

    it('dancers swap positions after half rotation', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];

      // up_lark starts at (-0.5,-0.5), neighbor is down_robin at (-0.5,0.5)
      // After half rotation, they swap: up_lark ends near (-0.5,0.5), down_robin near (-0.5,-0.5)
      expect(last.dancers['up_lark'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['up_lark'].y).toBeCloseTo(0.5, 1);
      expect(last.dancers['down_robin'].x).toBeCloseTo(-0.5, 1);
      expect(last.dancers['down_robin'].y).toBeCloseTo(-0.5, 1);
    });

    it('dancers face center during allemande', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 8, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      // Check a mid-point frame - dancers should face roughly toward center
      const midIdx = Math.floor(kfs.length / 2);
      const mid = kfs[midIdx];

      // Neighbor pair: up_lark + down_robin, center at (-0.5, 0)
      const ulFacing = mid.dancers['up_lark'].facing;
      const cx = -0.5, cy = 0;
      const expectedAngle = Math.atan2(cx - mid.dancers['up_lark'].x, cy - mid.dancers['up_lark'].y) * 180 / Math.PI;
      const normalizedExpected = ((expectedAngle % 360) + 360) % 360;
      const normalizedActual = ((ulFacing % 360) + 360) % 360;
      expect(normalizedActual).toBeCloseTo(normalizedExpected, 0);
    });

    it('non-selected dancers stay in place', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'ups', beats: 4, type: 'allemande', relationship: 'neighbor', direction: 'cw', rotations: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Down dancers should be unchanged
      expect(last.dancers['down_lark']).toEqual(init.dancers['down_lark']);
      expect(last.dancers['down_robin']).toEqual(init.dancers['down_robin']);
    });
  });

  describe('step', () => {
    it('moves dancers up by distance', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // up = 0° = +y in world coords (worldToCanvas maps +y to higher on screen)
      for (const id of Object.keys(init.dancers)) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y + 1, 5);
      }
    });

    it('moves dancers down by distance', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'down' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // down = 180° = -y
      for (const id of Object.keys(init.dancers)) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y - 0.5, 5);
      }
    });

    it('moves dancers across (toward center of set)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'across' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // x < 0 → step east (+x), x > 0 → step west (-x)
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x - 0.5, 5);
    });

    it('moves dancers out (away from center)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'out' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // x < 0 → step west (-x), x > 0 → step east (+x)
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x - 0.5, 5);
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x + 0.5, 5);
    });

    it('moves dancers CW degrees from their current facing', () => {
      const instructions: Instruction[] = [
        // All ups face 0° (north), so 90° CW = east = +x
        { id: 1, selector: 'ups', beats: 4, type: 'step', direction: { kind: 'cw', value: 90 }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // up_lark faces 0°, step 90° CW from that = east
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 1, 5);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 5);
      // down dancers unchanged
      expect(last.dancers['down_lark']).toEqual(init.dancers['down_lark']);
    });

    it('CW degrees is relative to each dancers current facing', () => {
      const instructions: Instruction[] = [
        // Ups face 0° (north), downs face 180° (south)
        // 90° CW from 0° = 90° (east), 90° CW from 180° = 270° (west)
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'cw', value: 90 }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups step east (+x)
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 1, 5);
      // Downs step west (-x) because 90° CW from 180° = 270° = west
      expect(last.dancers['down_lark'].x).toBeCloseTo(init.dancers['down_lark'].x - 1, 5);
    });

    it('moves dancers toward a relationship target', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'relationship', value: 'partner' }, distance: 0.5 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // up_lark(-0.5,-0.5) steps toward up_robin(0.5,-0.5) → +x
      expect(last.dancers['up_lark'].x).toBeCloseTo(init.dancers['up_lark'].x + 0.5, 5);
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y, 5);
      // up_robin(0.5,-0.5) steps toward up_lark(-0.5,-0.5) → -x
      expect(last.dancers['up_robin'].x).toBeCloseTo(init.dancers['up_robin'].x - 0.5, 5);
    });

    it('moves dancers in their progression direction', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Ups progress up (+y), downs progress down (-y)
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['up_robin'].y).toBeCloseTo(init.dancers['up_robin'].y + 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y - 1, 5);
      expect(last.dancers['down_robin'].y).toBeCloseTo(init.dancers['down_robin'].y - 1, 5);
    });

    it('moves dancers in their anti-progression direction', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'anti-progression' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // Opposite of progression
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y - 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y + 1, 5);
    });

    it('only moves selected dancers', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'larks', beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      expect(last.dancers['up_lark'].y).toBeCloseTo(init.dancers['up_lark'].y + 1, 5);
      expect(last.dancers['down_lark'].y).toBeCloseTo(init.dancers['down_lark'].y + 1, 5);
      // Robins unchanged
      expect(last.dancers['up_robin']).toEqual(init.dancers['up_robin']);
      expect(last.dancers['down_robin']).toEqual(init.dancers['down_robin']);
    });

    it('produces multiple keyframes with easing', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs.length).toBeGreaterThan(2);
      expect(kfs[kfs.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('preserves hands through step', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'right' },
        { id: 2, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'direction', value: 'up' }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      expect(last.hands).toHaveLength(2);
    });
  });

  describe('instruction sequencing', () => {
    it('beats accumulate across instructions', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'turn', target: { kind: 'direction', value: 'up' } },
        { id: 2, selector: 'everyone', beats: 4, type: 'turn', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[0].beat).toBe(0);
      // First instruction ends at beat 4
      // Second instruction ends at beat 8
      expect(kfs[kfs.length - 1].beat).toBe(8);
    });
  });
});
