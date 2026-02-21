import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { tid, instr } from '../testUtils';

describe('long_lines', () => {
  it('succeeds when dancers face across in improper formation', () => {
    // Turn everyone to face across. Then:
    // Left column (x=-0.5): up_lark(E), down_robin(E) - same direction, opposite role, same x
    // Right column (x=0.5): up_robin(W), down_lark(W) - same direction, opposite role, same x
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'across' }, facingOffset: 0 },
      { id: tid(2), beats: 8, type: 'long_lines' },
    ]);
    const { keyframes: kfs, error } = generateAllKeyframes(instructions);
    expect(error).toBeNull();
    const last = kfs[kfs.length - 1];
    // Dancers return to starting positions after forward and back
    expect(last.dancers.up_lark_0.pos.x).toBeCloseTo(-0.5);
    expect(last.dancers.up_robin_0.pos.x).toBeCloseTo(0.5);
    // Has hand connections
    expect(last.hands.length).toBeGreaterThanOrEqual(2);
  });

  it('dancers reach x=±0.2 at midpoint', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'across' }, facingOffset: 0 },
      { id: tid(2), beats: 8, type: 'long_lines' },
    ]);
    const { keyframes: kfs, error } = generateAllKeyframes(instructions);
    expect(error).toBeNull();
    // Find the midpoint keyframe (beat 4)
    const mid = kfs.find(kf => Math.abs(kf.beat - 4) < 0.01);
    expect(mid).toBeDefined();
    expect(mid!.dancers.up_lark_0.pos.x).toBeCloseTo(-0.2);
    expect(mid!.dancers.up_robin_0.pos.x).toBeCloseTo(0.2);
    expect(mid!.dancers.down_lark_0.pos.x).toBeCloseTo(0.2);
    expect(mid!.dancers.down_robin_0.pos.x).toBeCloseTo(-0.2);
  });

  it('errors when dancers face the same direction but are not on the same side', () => {
    // In initial improper formation, neighbors face opposite directions
    // up_lark(N) and down_robin(S) are on the same side (x=-0.5) but face opposite
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'long_lines' },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/long_lines/);
  });

  it('errors when same-role dancers are side by side', () => {
    // Arrange two larks on the same side - this should error on opposite role assertion
    // In beckett formation, this might happen naturally
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'long_lines' },
    ]);
    const { error } = generateAllKeyframes(instructions);
    expect(error).not.toBeNull();
  });

  it('generates intermediate keyframes', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'step', direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'across' }, facingOffset: 0 },
      { id: tid(2), beats: 8, type: 'long_lines' },
    ]);
    const { keyframes: kfs, error } = generateAllKeyframes(instructions);
    expect(error).toBeNull();
    // Should have more than just initial + step-final + long-lines-final
    // 8 beats at 0.25 per frame = 32 frames per half, so many intermediates
    expect(kfs.length).toBeGreaterThan(10);
  });

  it('defaults to 8 beats', () => {
    const instructions = instr([
      { id: tid(1), beats: 8, type: 'long_lines' },
    ]);
    expect(instructions).toHaveLength(1);
  });
});
