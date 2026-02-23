import { describe, it, expect } from 'vitest';
import { initialKeyframe } from '../../generate';
import { EAST, WEST } from '../../types';
import { tid, expectFacingCloseTo } from '../testUtils';
import { finalRightLeftThrough } from './rightLeftThrough';
import { PROTO_DANCER_IDS } from '../../generateUtils';

describe('right_left_through', () => {
  it('dancers end on opposite side from where they started', () => {
    const start = initialKeyframe('beckett');
    const end = finalRightLeftThrough(start, { id: tid(1), beats: 8, type: 'right_left_through' });
    
    for (const id of PROTO_DANCER_IDS) {
      expect(end.dancers[id].pos.x > 0).not.toBe(start.dancers[id].pos.x > 0);
    }
  });

  it('dancers end facing across the set', () => {
    const start = initialKeyframe('beckett');
    const end = finalRightLeftThrough(start, { id: tid(1), beats: 8, type: 'right_left_through' });
    
    for (const id of ['up_lark_0', 'up_robin_0', 'down_lark_0', 'down_robin_0'] as const) {
      const expected = end.dancers[id].pos.x < 0 ? EAST : WEST;
      expectFacingCloseTo(end.dancers[id].facing, expected, 0);
    }
  });

  it('ends holding left hands only', () => {
    const start = initialKeyframe('beckett');
    const end = finalRightLeftThrough(start, { id: tid(1), beats: 8, type: 'right_left_through' });

    // Should have left-left hand connections
    for (const h of end.hands) {
      expect(h.ha).toBe('left');
      expect(h.hb).toBe('left');
    }
    expect(end.hands.length).toBeGreaterThan(0);
  });
});
