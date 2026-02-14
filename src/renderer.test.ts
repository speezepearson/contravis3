import { describe, it, expect } from "vitest";
import { getFrameAtBeat } from "./renderer";
import type { Keyframe } from "./types";

// Helper to build a simple keyframe
function makeKeyframe(
  beat: number,
  positions: {
    up_lark_0: [number, number, number];
    up_robin_0: [number, number, number];
    down_lark_0: [number, number, number];
    down_robin_0: [number, number, number];
  },
): Keyframe {
  return {
    beat,
    dancers: {
      up_lark_0: {
        x: positions.up_lark_0[0],
        y: positions.up_lark_0[1],
        facing: positions.up_lark_0[2],
      },
      up_robin_0: {
        x: positions.up_robin_0[0],
        y: positions.up_robin_0[1],
        facing: positions.up_robin_0[2],
      },
      down_lark_0: {
        x: positions.down_lark_0[0],
        y: positions.down_lark_0[1],
        facing: positions.down_lark_0[2],
      },
      down_robin_0: {
        x: positions.down_robin_0[0],
        y: positions.down_robin_0[1],
        facing: positions.down_robin_0[2],
      },
    },
    hands: { up_lark_0: {}, up_robin_0: {}, down_lark_0: {}, down_robin_0: {} },
  };
}

// Uniform positions for simple testing (all dancers at same coords, varying by beat)
function uniformKeyframes(): Keyframe[] {
  const pos = (v: number): [number, number, number] => [v, v, 0];
  return [
    makeKeyframe(0, {
      up_lark_0: pos(0),
      up_robin_0: pos(0),
      down_lark_0: pos(0),
      down_robin_0: pos(0),
    }),
    makeKeyframe(4, {
      up_lark_0: pos(1),
      up_robin_0: pos(1),
      down_lark_0: pos(1),
      down_robin_0: pos(1),
    }),
    makeKeyframe(8, {
      up_lark_0: pos(2),
      up_robin_0: pos(2),
      down_lark_0: pos(2),
      down_robin_0: pos(2),
    }),
    makeKeyframe(12, {
      up_lark_0: pos(3),
      up_robin_0: pos(3),
      down_lark_0: pos(3),
      down_robin_0: pos(3),
    }),
  ];
}

describe("getFrameAtBeat", () => {
  describe("edge cases", () => {
    it("returns null for empty keyframes", () => {
      expect(getFrameAtBeat([], 5)).toBeNull();
    });

    it("returns first keyframe when beat is before first", () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, -1);
      expect(frame).toEqual(kfs[0]);
    });

    it("returns last keyframe when beat is after last", () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, 100);
      expect(frame).toEqual(kfs[kfs.length - 1]);
    });

    it("handles a single keyframe", () => {
      const kfs = [uniformKeyframes()[0]];
      expect(getFrameAtBeat(kfs, 0)).toEqual(kfs[0]);
      expect(getFrameAtBeat(kfs, 5)).toEqual(kfs[0]);
    });

    it("handles two keyframes with smoothness", () => {
      const kfs = uniformKeyframes().slice(0, 2);
      const frame = getFrameAtBeat(kfs, 2, 1)!;
      expect(frame).not.toBeNull();
      expect(frame.beat).toBe(2);
    });
  });

  describe("smoothness=0 (linear)", () => {
    it("produces linear interpolation at midpoint", () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, 6, 0)!;
      // Beat 6 is midpoint between kf[1] (beat 4, x=1) and kf[2] (beat 8, x=2)
      expect(frame.dancers.up_lark_0.x).toBeCloseTo(1.5);
      expect(frame.dancers.up_lark_0.y).toBeCloseTo(1.5);
    });

    it("returns exact keyframe values at keyframe beats", () => {
      const kfs = uniformKeyframes();
      const frame = getFrameAtBeat(kfs, 4, 0)!;
      expect(frame.dancers.up_lark_0.x).toBeCloseTo(1);
    });
  });

  describe("moving-average smoothing", () => {
    // Create a step function: x stays at 0, then jumps to 1 at beat 4
    // With keyframes every 1 beat to make the step sharp.
    function stepKeyframes(): Keyframe[] {
      const pos = (v: number): [number, number, number] => [v, 0, 0];
      const z: [number, number, number] = [0, 0, 0];
      return [
        makeKeyframe(0, {
          up_lark_0: pos(0),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(1, {
          up_lark_0: pos(0),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(2, {
          up_lark_0: pos(0),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(3, {
          up_lark_0: pos(0),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(4, {
          up_lark_0: pos(1),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(5, {
          up_lark_0: pos(1),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(6, {
          up_lark_0: pos(1),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(7, {
          up_lark_0: pos(1),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(8, {
          up_lark_0: pos(1),
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
      ];
    }

    it("with smoothness=0, step function has a 1-beat ramp", () => {
      const kfs = stepKeyframes();
      // Well before the ramp (beat 3→4): fully 0
      expect(getFrameAtBeat(kfs, 2.5, 0)!.dancers.up_lark_0.x).toBeCloseTo(0);
      // Well after the ramp: fully 1
      expect(getFrameAtBeat(kfs, 5.5, 0)!.dancers.up_lark_0.x).toBeCloseTo(1);
      // Mid-ramp: exactly 0.5
      expect(getFrameAtBeat(kfs, 3.5, 0)!.dancers.up_lark_0.x).toBeCloseTo(0.5);
    });

    it("smoothing blurs a sharp step into a gradual ramp", () => {
      const kfs = stepKeyframes();
      // With a 2-beat window centered on beat 3.5:
      //   raw samples from [2.5, 4.5] — the step at 3→4 is inside the window
      //   so the average should be between 0 and 1
      const frame = getFrameAtBeat(kfs, 3.5, 2)!;
      const x = frame.dancers.up_lark_0.x;
      expect(x).toBeGreaterThan(0.1);
      expect(x).toBeLessThan(0.9);
    });

    it("smoothing has no effect on a constant signal", () => {
      const kfs = stepKeyframes();
      // At beat 1.0, the raw signal is 0 everywhere in any window
      const frame = getFrameAtBeat(kfs, 1, 2)!;
      expect(frame.dancers.up_lark_0.x).toBeCloseTo(0);
    });

    it("smoothing has no effect on a linear signal", () => {
      const kfs = uniformKeyframes(); // x goes 0,1,2,3 at beats 0,4,8,12
      // At beat 6, x = 1.5 linearly. A moving average of a linear function
      // is still linear (same value at center), so smoothing shouldn't change it.
      const raw = getFrameAtBeat(kfs, 6, 0)!.dancers.up_lark_0.x;
      const smoothed = getFrameAtBeat(kfs, 6, 2)!.dancers.up_lark_0.x;
      expect(smoothed).toBeCloseTo(raw, 1);
    });

    it("larger window produces more smoothing", () => {
      const kfs = stepKeyframes();
      // At beat 2.5, raw value is 0. A small window stays in the 0 region,
      // but a large window reaches into the ramp (beat 3→4), pulling the average up.
      const small = getFrameAtBeat(kfs, 2.5, 1)!.dancers.up_lark_0.x;
      const large = getFrameAtBeat(kfs, 2.5, 4)!.dancers.up_lark_0.x;
      expect(small).toBeCloseTo(0);
      expect(large).toBeGreaterThan(small + 0.05);
    });

    it("smoothing handles facing angles near 0/360 boundary", () => {
      // Facing goes from 350 to 10 (crossing 0)
      const z: [number, number, number] = [0, 0, 0];
      const kfs = [
        makeKeyframe(0, {
          up_lark_0: [0, 0, 350],
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(2, {
          up_lark_0: [0, 0, 350],
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(4, {
          up_lark_0: [0, 0, 10],
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
        makeKeyframe(6, {
          up_lark_0: [0, 0, 10],
          up_robin_0: z,
          down_lark_0: z,
          down_robin_0: z,
        }),
      ];
      const frame = getFrameAtBeat(kfs, 3, 2)!;
      const f = frame.dancers.up_lark_0.facing;
      // Should be near 0 (between 350 and 10), not near 180
      expect(f > 340 || f < 20).toBe(true);
    });
  });
});
