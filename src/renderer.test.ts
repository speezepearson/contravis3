import { describe, it, expect } from 'vitest';
import { Vector } from 'vecti';
import { getFrameAtBeat } from './renderer';
import type { Keyframe } from './types';

// Helper to build a simple keyframe
function makeKeyframe(beat: number, positions: {
  up_lark_0: [number, number, number];
  up_robin_0: [number, number, number];
  down_lark_0: [number, number, number];
  down_robin_0: [number, number, number];
}): Keyframe {
  return {
    beat,
    dancers: {
      up_lark_0:    { pos: new Vector(positions.up_lark_0[0],    positions.up_lark_0[1]),    facing: positions.up_lark_0[2] },
      up_robin_0:   { pos: new Vector(positions.up_robin_0[0],   positions.up_robin_0[1]),   facing: positions.up_robin_0[2] },
      down_lark_0:  { pos: new Vector(positions.down_lark_0[0],  positions.down_lark_0[1]),  facing: positions.down_lark_0[2] },
      down_robin_0: { pos: new Vector(positions.down_robin_0[0], positions.down_robin_0[1]), facing: positions.down_robin_0[2] },
    },
    hands: [],
  };
}

// Uniform positions for simple testing (all dancers at same coords, varying by beat)
function uniformKeyframes(): Keyframe[] {
  const pos = (v: number): [number, number, number] => [v, v, 0];
  return [
    makeKeyframe(0, { up_lark_0: pos(0), up_robin_0: pos(0), down_lark_0: pos(0), down_robin_0: pos(0) }),
    makeKeyframe(4, { up_lark_0: pos(1), up_robin_0: pos(1), down_lark_0: pos(1), down_robin_0: pos(1) }),
    makeKeyframe(8, { up_lark_0: pos(2), up_robin_0: pos(2), down_lark_0: pos(2), down_robin_0: pos(2) }),
    makeKeyframe(12, { up_lark_0: pos(3), up_robin_0: pos(3), down_lark_0: pos(3), down_robin_0: pos(3) }),
  ];
}

describe('getFrameAtBeat', () => {
  describe('edge cases', () => {
    it('returns null for empty keyframes', () => {
      expect(getFrameAtBeat([], 5)).toBeNull();
    });

    it('wraps negative beats into [0, danceLength)', () => {
      const kfs = uniformKeyframes();
      // beat -1 wraps to 63 (danceLength=64), which is past last keyframe (beat 12)
      const frame = getFrameAtBeat(kfs, -1);
      expect(frame).toEqual(kfs[kfs.length - 1]);
    });

    it('wraps beats beyond dance length', () => {
      const kfs = uniformKeyframes();
      // beat 66 wraps to 2 (66 % 64 = 2), between kf[0](beat 0, x=0) and kf[1](beat 4, x=1)
      const frame = getFrameAtBeat(kfs, 66, 0, 64, 0)!;
      expect(frame.dancers.up_lark_0.pos.x).toBeCloseTo(0.5);
    });

    it('t=-0.3 equals t=63.7', () => {
      const kfs = uniformKeyframes();
      const neg = getFrameAtBeat(kfs, -0.3);
      const pos = getFrameAtBeat(kfs, 63.7);
      expect(neg).toEqual(pos);
    });

    it('returns last keyframe when beat is after last but within dance length', () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, 20);
      expect(frame).toEqual(kfs[kfs.length - 1]);
    });

    it('handles a single keyframe', () => {
      const kfs = [uniformKeyframes()[0]];
      expect(getFrameAtBeat(kfs, 0)).toEqual(kfs[0]);
      expect(getFrameAtBeat(kfs, 5)).toEqual(kfs[0]);
    });

    it('handles two keyframes with smoothness', () => {
      const kfs = uniformKeyframes().slice(0, 2);
      const frame = getFrameAtBeat(kfs, 2, 1)!;
      expect(frame).not.toBeNull();
      expect(frame.beat).toBe(2);
    });
  });

  describe('smoothness=0 (linear)', () => {
    it('produces linear interpolation at midpoint', () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, 6, 0)!;
      // Beat 6 is midpoint between kf[1] (beat 4, x=1) and kf[2] (beat 8, x=2)
      expect(frame.dancers.up_lark_0.pos.x).toBeCloseTo(1.5);
      expect(frame.dancers.up_lark_0.pos.y).toBeCloseTo(1.5);
    });

    it('returns exact keyframe values at keyframe beats', () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, 4, 0)!;
      expect(frame.dancers.up_lark_0.pos.x).toBeCloseTo(1);
    });
  });

  describe('moving-average smoothing', () => {
    // Create a step function: x stays at 0, then jumps to 1 at beat 4
    // With keyframes every 1 beat to make the step sharp.
    function stepKeyframes(): Keyframe[] {
      const pos = (v: number): [number, number, number] => [v, 0, 0];
      const z: [number, number, number] = [0, 0, 0];
      return [
        makeKeyframe(0, { up_lark_0: pos(0), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(1, { up_lark_0: pos(0), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(2, { up_lark_0: pos(0), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(3, { up_lark_0: pos(0), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(4, { up_lark_0: pos(1), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(5, { up_lark_0: pos(1), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(6, { up_lark_0: pos(1), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(7, { up_lark_0: pos(1), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(8, { up_lark_0: pos(1), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
      ];
    }

    it('with smoothness=0, step function has a 1-beat ramp', () => {
      const kfs = stepKeyframes();
      // Well before the ramp (beat 3->4): fully 0
      expect(getFrameAtBeat(kfs, 2.5, 0)!.dancers.up_lark_0.pos.x).toBeCloseTo(0);
      // Well after the ramp: fully 1
      expect(getFrameAtBeat(kfs, 5.5, 0)!.dancers.up_lark_0.pos.x).toBeCloseTo(1);
      // Mid-ramp: exactly 0.5
      expect(getFrameAtBeat(kfs, 3.5, 0)!.dancers.up_lark_0.pos.x).toBeCloseTo(0.5);
    });

    it('smoothing blurs a sharp step into a gradual ramp', () => {
      const kfs = stepKeyframes();
      // With a 2-beat window centered on beat 3.5:
      //   raw samples from [2.5, 4.5] — the step at 3->4 is inside the window
      //   so the average should be between 0 and 1
      const frame = getFrameAtBeat(kfs, 3.5, 2)!;
      const x = frame.dancers.up_lark_0.pos.x;
      expect(x).toBeGreaterThan(0.1);
      expect(x).toBeLessThan(0.9);
    });

    it('smoothing has no effect on a constant signal', () => {
      const kfs = stepKeyframes();
      // At beat 1.0, the raw signal is 0 everywhere in any window
      const frame = getFrameAtBeat(kfs, 1, 2)!;
      expect(frame.dancers.up_lark_0.pos.x).toBeCloseTo(0);
    });

    it('smoothing has no effect on a linear signal', () => {
      const kfs = uniformKeyframes(); // x goes 0,1,2,3 at beats 0,4,8,12
      // At beat 6, x = 1.5 linearly. A moving average of a linear function
      // is still linear (same value at center), so smoothing shouldn't change it.
      const raw = getFrameAtBeat(kfs, 6, 0)!.dancers.up_lark_0.pos.x;
      const smoothed = getFrameAtBeat(kfs, 6, 2)!.dancers.up_lark_0.pos.x;
      expect(smoothed).toBeCloseTo(raw, 1);
    });

    it('larger window produces more smoothing', () => {
      const kfs = stepKeyframes();
      // At beat 2.5, raw value is 0. A small window stays in the 0 region,
      // but a large window reaches into the ramp (beat 3->4), pulling the average up.
      const small = getFrameAtBeat(kfs, 2.5, 1)!.dancers.up_lark_0.pos.x;
      const large = getFrameAtBeat(kfs, 2.5, 4)!.dancers.up_lark_0.pos.x;
      expect(small).toBeCloseTo(0);
      expect(large).toBeGreaterThan(small + 0.05);
    });

    it('smoothing handles facing angles near 0/2pi boundary', () => {
      // Facing goes from ~350 deg to ~10 deg (crossing 0), in radians
      const deg2rad = (d: number) => d * Math.PI / 180;
      const z: [number, number, number] = [0, 0, 0];
      const kfs = [
        makeKeyframe(0, { up_lark_0: [0, 0, deg2rad(350)], up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(2, { up_lark_0: [0, 0, deg2rad(350)], up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(4, { up_lark_0: [0, 0, deg2rad(10)],  up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(6, { up_lark_0: [0, 0, deg2rad(10)],  up_robin_0: z, down_lark_0: z, down_robin_0: z }),
      ];
      const frame = getFrameAtBeat(kfs, 3, 2)!;
      const f = frame.dancers.up_lark_0.facing;
      // Should be near 0 (between 350 deg and 10 deg), not near pi
      expect(f > deg2rad(340) || f < deg2rad(20)).toBe(true);
    });
  });

  describe('progression', () => {
    it('t=65 with progression=1 translates up dancers +1 and down dancers -1 in y', () => {
      const kfs = uniformKeyframes();
      const base = getFrameAtBeat(kfs, 1, 0, 64, 0)!;
      const progressed = getFrameAtBeat(kfs, 65, 0, 64, 1)!;
      // up dancers: y += 1
      expect(progressed.dancers.up_lark_0.pos.y).toBeCloseTo(base.dancers.up_lark_0.pos.y + 1);
      expect(progressed.dancers.up_robin_0.pos.y).toBeCloseTo(base.dancers.up_robin_0.pos.y + 1);
      // down dancers: y -= 1
      expect(progressed.dancers.down_lark_0.pos.y).toBeCloseTo(base.dancers.down_lark_0.pos.y - 1);
      expect(progressed.dancers.down_robin_0.pos.y).toBeCloseTo(base.dancers.down_robin_0.pos.y - 1);
      // x unchanged
      expect(progressed.dancers.up_lark_0.pos.x).toBeCloseTo(base.dancers.up_lark_0.pos.x);
    });

    it('t=-1 with progression=1 translates the other way', () => {
      const kfs = uniformKeyframes();
      const base = getFrameAtBeat(kfs, 63, 0, 64, 0)!;
      const progressed = getFrameAtBeat(kfs, -1, 0, 64, 1)!;
      // cycle = -1, so up dancers y -= 1, down dancers y += 1
      expect(progressed.dancers.up_lark_0.pos.y).toBeCloseTo(base.dancers.up_lark_0.pos.y - 1);
      expect(progressed.dancers.down_lark_0.pos.y).toBeCloseTo(base.dancers.down_lark_0.pos.y + 1);
    });

    it('progression=0 applies no translation', () => {
      const kfs = uniformKeyframes();
      const base = getFrameAtBeat(kfs, 1, 0, 64, 0)!;
      const same = getFrameAtBeat(kfs, 65, 0, 64, 0)!;
      expect(same.dancers.up_lark_0.pos.y).toBeCloseTo(base.dancers.up_lark_0.pos.y);
    });

    it('progression=2 doubles the translation', () => {
      const kfs = uniformKeyframes();
      const base = getFrameAtBeat(kfs, 1, 0, 64, 0)!;
      const progressed = getFrameAtBeat(kfs, 65, 0, 64, 2)!;
      expect(progressed.dancers.up_lark_0.pos.y).toBeCloseTo(base.dancers.up_lark_0.pos.y + 2);
      expect(progressed.dancers.down_lark_0.pos.y).toBeCloseTo(base.dancers.down_lark_0.pos.y - 2);
    });

    it('two cycles applies twice the translation', () => {
      const kfs = uniformKeyframes();
      const base = getFrameAtBeat(kfs, 1, 0, 64, 0)!;
      const progressed = getFrameAtBeat(kfs, 129, 0, 64, 1)!; // cycle=2
      expect(progressed.dancers.up_lark_0.pos.y).toBeCloseTo(base.dancers.up_lark_0.pos.y + 2);
      expect(progressed.dancers.down_lark_0.pos.y).toBeCloseTo(base.dancers.down_lark_0.pos.y - 2);
    });
  });

  describe('wrap=false', () => {
    it('negative beats clamp to first keyframe instead of wrapping', () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, -1, 0, 64, 0, false)!;
      // Should clamp to first keyframe (beat 0, x=0), not wrap to beat 63
      expect(frame.dancers.up_lark_0.pos.x).toBeCloseTo(0);
      expect(frame.dancers.up_lark_0.pos.y).toBeCloseTo(0);
    });

    it('beats beyond dance length clamp to last keyframe instead of wrapping', () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, 66, 0, 64, 0, false)!;
      // Should clamp to last keyframe (beat 12, x=3), not wrap to beat 2
      expect(frame.dancers.up_lark_0.pos.x).toBeCloseTo(3);
    });

    it('no progression applied when clamped', () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, -1, 0, 64, 1, false)!;
      // With wrap=true, t=-1 applies cycle=-1 progression; with wrap=false, no progression
      const first = kfs[0];
      expect(frame.dancers.up_lark_0.pos.y).toBeCloseTo(first.dancers.up_lark_0.pos.y);
      expect(frame.dancers.down_lark_0.pos.y).toBeCloseTo(first.dancers.down_lark_0.pos.y);
    });

    it('interpolation within keyframe range is unchanged', () => {
      const kfs = uniformKeyframes();
      const wrapped = getFrameAtBeat(kfs, 6, 0, 64, 0, true)!;
      const noWrap = getFrameAtBeat(kfs, 6, 0, 64, 0, false)!;
      // Within range, wrap makes no difference
      expect(noWrap.dancers.up_lark_0.pos.x).toBeCloseTo(wrapped.dancers.up_lark_0.pos.x);
      expect(noWrap.dancers.up_lark_0.pos.y).toBeCloseTo(wrapped.dancers.up_lark_0.pos.y);
    });

    it('smoothing near beat 0 does not pull in values from end of dance', () => {
      // Create keyframes where start and end positions differ significantly
      const pos = (v: number): [number, number, number] => [v, 0, 0];
      const z: [number, number, number] = [0, 0, 0];
      const kfs = [
        makeKeyframe(0,  { up_lark_0: pos(0), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(4,  { up_lark_0: pos(0), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(8,  { up_lark_0: pos(5), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
        makeKeyframe(12, { up_lark_0: pos(5), up_robin_0: z, down_lark_0: z, down_robin_0: z }),
      ];
      // Smoothing with window=4 around beat 0: samples from [-2, 2]
      // wrap=true: negative samples wrap to ~62, hitting the last kf (x=5), inflating average
      // wrap=false: negative samples clamp to first kf (x=0), average stays near 0
      const smoothedWrap = getFrameAtBeat(kfs, 0, 4, 64, 0, true)!;
      const smoothedNoWrap = getFrameAtBeat(kfs, 0, 4, 64, 0, false)!;
      // With wrap, the average gets pulled toward x=5
      expect(smoothedWrap.dancers.up_lark_0.pos.x).toBeGreaterThan(1);
      // Without wrap, the average stays near x=0
      expect(smoothedNoWrap.dancers.up_lark_0.pos.x).toBeCloseTo(0);
    });
  });
});
