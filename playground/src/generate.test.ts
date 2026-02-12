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

  describe('face', () => {
    it('faces dancers up (0 degrees)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'face', target: { kind: 'direction', value: 'up' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(0);
      }
    });

    it('faces dancers down (180 degrees)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'face', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(180);
      }
    });

    it('faces dancers across (toward the other side of the set)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'face', target: { kind: 'direction', value: 'across' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // x < 0 → face 90° (east), x > 0 → face 270° (west)
      expect(last.dancers['up_lark'].facing).toBe(90);    // x=-0.5
      expect(last.dancers['down_robin'].facing).toBe(90);  // x=-0.5
      expect(last.dancers['up_robin'].facing).toBe(270);   // x=0.5
      expect(last.dancers['down_lark'].facing).toBe(270);  // x=0.5
    });

    it('faces dancers out (away from center)', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'face', target: { kind: 'direction', value: 'out' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // x < 0 → face 270° (west), x > 0 → face 90° (east)
      expect(last.dancers['up_lark'].facing).toBe(270);
      expect(last.dancers['down_robin'].facing).toBe(270);
      expect(last.dancers['up_robin'].facing).toBe(90);
      expect(last.dancers['down_lark'].facing).toBe(90);
    });

    it('faces dancers a specific number of degrees', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'face', target: { kind: 'degrees', value: 45 } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      for (const d of Object.values(last.dancers)) {
        expect(d.facing).toBe(45);
      }
    });

    it('faces selected dancers toward a relationship target', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 0, type: 'face', target: { kind: 'relationship', value: 'partner' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // up_lark(-0.5,-0.5) faces up_robin(0.5,-0.5) → east = 90°
      expect(last.dancers['up_lark'].facing).toBeCloseTo(90, 5);
      // up_robin(0.5,-0.5) faces up_lark(-0.5,-0.5) → west = 270°
      expect(last.dancers['up_robin'].facing).toBeCloseTo(270, 5);
      // down_lark(0.5,0.5) faces down_robin(-0.5,0.5) → west = 270°
      expect(last.dancers['down_lark'].facing).toBeCloseTo(270, 5);
      // down_robin(-0.5,0.5) faces down_lark(0.5,0.5) → east = 90°
      expect(last.dancers['down_robin'].facing).toBeCloseTo(90, 5);
    });

    it('only affects selected dancers', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'ups', beats: 0, type: 'face', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      const last = kfs[kfs.length - 1];
      // ups (up_lark, up_robin) face down (180)
      expect(last.dancers['up_lark'].facing).toBe(180);
      expect(last.dancers['up_robin'].facing).toBe(180);
      // downs unchanged (still facing 180 from initial)
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

    it('moves dancers by a degree heading', () => {
      const instructions: Instruction[] = [
        { id: 1, selector: 'everyone', beats: 4, type: 'step', direction: { kind: 'degrees', value: 90 }, distance: 1 },
      ];
      const kfs = generateAllKeyframes(instructions);
      const init = initialKeyframe();
      const last = kfs[kfs.length - 1];
      // 90° = east = +x
      for (const id of Object.keys(init.dancers)) {
        expect(last.dancers[id].x).toBeCloseTo(init.dancers[id].x + 1, 5);
        expect(last.dancers[id].y).toBeCloseTo(init.dancers[id].y, 5);
      }
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
        { id: 1, selector: 'everyone', beats: 4, type: 'face', target: { kind: 'direction', value: 'up' } },
        { id: 2, selector: 'everyone', beats: 4, type: 'face', target: { kind: 'direction', value: 'down' } },
      ];
      const kfs = generateAllKeyframes(instructions);
      expect(kfs[0].beat).toBe(0);
      // First instruction ends at beat 4
      // Second instruction ends at beat 8
      expect(kfs[kfs.length - 1].beat).toBe(8);
    });
  });
});
