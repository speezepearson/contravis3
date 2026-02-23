import { describe, it, expect } from 'vitest';
import { generateAllKeyframes } from '../../generate';
import { tid, instr } from '../testUtils';

describe('turn_as_a_couple', () => {
  it('behaves identically to california_twirl', () => {
    const twirlInstrs = instr([
      { id: tid(1), beats: 4, type: 'california_twirl' },
    ]);
    const coupleInstrs = instr([
      { id: tid(2), beats: 4, type: 'turn_as_a_couple' },
    ]);
    const { keyframes: twirlKfs } = generateAllKeyframes(twirlInstrs, 'improper');
    const { keyframes: coupleKfs } = generateAllKeyframes(coupleInstrs, 'improper');
    const twirlLast = twirlKfs[twirlKfs.length - 1];
    const coupleLast = coupleKfs[coupleKfs.length - 1];
    for (const id of ['up_lark_0', 'up_robin_0', 'down_lark_0', 'down_robin_0'] as const) {
      expect(coupleLast.dancers[id].pos.x).toBeCloseTo(twirlLast.dancers[id].pos.x, 5);
      expect(coupleLast.dancers[id].pos.y).toBeCloseTo(twirlLast.dancers[id].pos.y, 5);
      expect(coupleLast.dancers[id].facing.x).toBeCloseTo(twirlLast.dancers[id].facing.x, 5);
      expect(coupleLast.dancers[id].facing.y).toBeCloseTo(twirlLast.dancers[id].facing.y, 5);
    }
    expect(coupleLast.hands).toEqual(twirlLast.hands);
  });
});
