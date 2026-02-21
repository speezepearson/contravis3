import { describe, it, expect } from 'vitest';
import { generateAllKeyframes, validateHandDistances, validateProgression } from './generate';
import { DanceSchema, NORTH, EAST, SOUTH, WEST } from './types';
import { tid, instr, initialKeyframe } from './figures/testUtils';

describe('generateAllKeyframes', () => {
  it('returns just the initial keyframe when no instructions', () => {
    const { keyframes: kfs } = generateAllKeyframes([]);
    expect(kfs).toHaveLength(1);
    expect(kfs[0].beat).toBe(0);
    expect(kfs[0].dancers).toEqual(initialKeyframe().dancers);
    expect(kfs[0].hands).toEqual([]);
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
    expect(kfs[0].dancers.up_lark_0.facing).toBe(NORTH);
    expect(kfs[0].dancers.down_lark_0.facing).toBe(SOUTH);
  });

  it('uses improper formation when initFormation is "improper"', () => {
    const { keyframes: kfs } = generateAllKeyframes([], 'improper');
    expect(kfs).toHaveLength(1);
    expect(kfs[0].dancers.up_lark_0).toEqual({ x: -0.5, y: -0.5, facing: NORTH });
    expect(kfs[0].dancers.down_lark_0).toEqual({ x: 0.5, y: 0.5, facing: SOUTH });
  });

  it('uses beckett formation when initFormation is "beckett"', () => {
    const { keyframes: kfs } = generateAllKeyframes([], 'beckett');
    expect(kfs).toHaveLength(1);
    // Beckett: everyone faces across (east-west) instead of up-down
    // Ups face east (90), downs face west (270)
    expect(kfs[0].dancers.up_lark_0.facing).toBe(EAST);
    expect(kfs[0].dancers.up_robin_0.facing).toBe(EAST);
    expect(kfs[0].dancers.down_lark_0.facing).toBe(WEST);
    expect(kfs[0].dancers.down_robin_0.facing).toBe(WEST);
  });

  it('beckett formation has correct positions', () => {
    const { keyframes: kfs } = generateAllKeyframes([], 'beckett');
    // Beckett = improper rotated 90° CW: (x,y) -> (y, -x), facing -> facing+90
    expect(kfs[0].dancers.up_lark_0).toEqual({ x: -0.5, y:  0.5, facing: EAST });
    expect(kfs[0].dancers.up_robin_0).toEqual({ x: -0.5, y: -0.5, facing: EAST });
    expect(kfs[0].dancers.down_lark_0).toEqual({ x:  0.5, y: -0.5, facing: WEST });
    expect(kfs[0].dancers.down_robin_0).toEqual({ x:  0.5, y:  0.5, facing: WEST });
  });

  describe('validateProgression', () => {
    it('returns null when dancers end at expected progression positions', () => {
      // Move each dancer 2m in their progression direction (progression=1)
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 3.0 },
      ]);
      const { keyframes } = generateAllKeyframes(instructions);
      expect(validateProgression(keyframes, 'improper', 3)).toBeNull();
    });

    it('warns when dancers do not end at expected positions', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'progression' }, distance: 0.5 },
      ]);
      const { keyframes } = generateAllKeyframes(instructions);
      const warning = validateProgression(keyframes, 'improper', 1);
      expect(warning).not.toBeNull();
      expect(warning).toMatch(/don't end at expected progression/);
    });

    it('returns null for progression=0 when dancers stay in place', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.0 },
      ]);
      const { keyframes } = generateAllKeyframes(instructions);
      expect(validateProgression(keyframes, 'improper', 0)).toBeNull();
    });
  });

  describe('partial keyframe preservation on error', () => {
    it('preserves keyframes from earlier instructions in a group when a later child fails', () => {
      // A group with a successful step followed by a failing take_hands (inside hand with neighbor
      // in improper formation → error because neighbor is directly in front).
      const instructions = instr([{
        id: tid(1), type: 'group', label: 'test group',
        instructions: [
          { id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 },
          { id: tid(11), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'inside' },
        ],
      }]);
      const { keyframes, error } = generateAllKeyframes(instructions);
      expect(error).not.toBeNull();
      expect(error!.instructionId).toBe(tid(11));
      // Should have the initial keyframe PLUS keyframes from the successful step
      expect(keyframes.length).toBeGreaterThan(1);
      expect(keyframes[keyframes.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('preserves keyframes from the successful branch of a split when the other branch fails', () => {
      // Split by role: larks do a step (succeeds), robins try inside-hand take with neighbor (fails).
      // In improper formation, robins at (0.5,-0.5) and (-0.5,0.5) face 0° and 180° respectively.
      // Their neighbor is directly in front → inside hand fails.
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'role',
        larks: [{ id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 }],
        robins: [{ id: tid(11), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'inside' }],
      }]);
      const { keyframes, error } = generateAllKeyframes(instructions);
      expect(error).not.toBeNull();
      expect(error!.instructionId).toBe(tid(11));
      // Should have the initial keyframe plus merged partial frames from the successful lark branch
      expect(keyframes.length).toBeGreaterThan(1);
      // The larks should have moved forward in the partial result
      const last = keyframes[keyframes.length - 1];
      const init = initialKeyframe();
      expect(last.dancers['up_lark_0'].y).not.toBeCloseTo(init.dancers['up_lark_0'].y, 5);
    });

    it('preserves keyframes from a successful first instruction when the second top-level instruction fails', () => {
      const instructions = instr([
        { id: tid(1), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 },
        { id: tid(2), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'inside' },
      ]);
      const { keyframes, error } = generateAllKeyframes(instructions);
      expect(error).not.toBeNull();
      expect(error!.instructionId).toBe(tid(2));
      // Should have the initial keyframe plus keyframes from the successful step
      expect(keyframes.length).toBeGreaterThan(1);
      expect(keyframes[keyframes.length - 1].beat).toBeCloseTo(4, 5);
    });

    it('KeyframeGenerationError includes partial keyframes from within a split branch sequence', () => {
      // Split by role: larks do two steps (both succeed), robins do a step then a failing take_hands.
      // The robin branch should preserve keyframes from its successful first step.
      const instructions = instr([{
        id: tid(1), type: 'split', by: 'role',
        larks: [
          { id: tid(10), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 },
          { id: tid(11), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 },
        ],
        robins: [
          { id: tid(20), beats: 4, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0.3 },
          { id: tid(21), beats: 0, type: 'take_hands', relationship: 'neighbor', hand: 'inside' },
        ],
      }]);
      const { keyframes, error } = generateAllKeyframes(instructions);
      expect(error).not.toBeNull();
      // Partial result should contain merged keyframes up to beat 4
      // (the successful first step from both branches)
      expect(keyframes.length).toBeGreaterThan(1);
      const last = keyframes[keyframes.length - 1];
      const init = initialKeyframe();
      // Both larks and robins should have moved from their initial positions in the partial result
      expect(last.dancers['up_lark_0'].y).not.toBeCloseTo(init.dancers['up_lark_0'].y, 5);
      expect(last.dancers['up_robin_0'].y).not.toBeCloseTo(init.dancers['up_robin_0'].y, 5);
    });
  });
});
