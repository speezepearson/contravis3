import { describe, it, expect } from 'vitest';
import { tid, instr, mustGenerateAllKeyframes } from '../testUtils';

describe('drop_hands', () => {
  it('removes hand connections for the relationship', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
      { id: tid(2), beats: 0, type: 'drop_hands', target: { base: 'neighbor', offset: 0 } },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(0);
  });

  it('only removes the specified relationship hands', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
      { id: tid(2), beats: 0, type: 'take_hands', relationship: { base: 'partner', offset: 0 }, hand: 'left' },
      { id: tid(3), beats: 0, type: 'drop_hands', target: { base: 'neighbor', offset: 0 } },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
    expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
  });

  it('drops by hand: removes all connections using that hand', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
      { id: tid(2), beats: 0, type: 'take_hands', relationship: { base: 'partner', offset: 0 }, hand: 'left' },
      { id: tid(3), beats: 0, type: 'drop_hands', target: 'right' },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    const last = kfs[kfs.length - 1];
    // Only partner left-hand connections remain
    expect(last.hands).toHaveLength(2);
    expect(last.hands).toContainEqual({ a: 'up_lark_0', ha: 'left', b: 'up_robin_0', hb: 'left' });
    expect(last.hands).toContainEqual({ a: 'down_lark_0', ha: 'left', b: 'down_robin_0', hb: 'left' });
  });

  it('drops both: removes all hand connections', () => {
    const instructions = instr([
      { id: tid(1), beats: 0, type: 'take_hands', relationship: { base: 'neighbor', offset: 0 }, hand: 'right' },
      { id: tid(2), beats: 0, type: 'take_hands', relationship: { base: 'partner', offset: 0 }, hand: 'left' },
      { id: tid(3), beats: 0, type: 'drop_hands', target: 'both' },
    ]);
    const kfs = mustGenerateAllKeyframes(instructions, 'improper');
    const last = kfs[kfs.length - 1];
    expect(last.hands).toHaveLength(0);
  });
});
