import { describe, it, expect } from 'vitest';
import { resolveRelationship, PROTO_DANCER_IDS, getRelationship } from './generateUtils';
import { BaseRelationshipSchema, makeDancerId, parseDancerId } from './types';
import type { BaseRelationship } from './types';

describe('resolveRelationship symmetry', () => {
  const bases: BaseRelationship[] = BaseRelationshipSchema.options;
  const offsets = [-2, -1, 0, 1, 2];

  for (const base of bases) {
    for (const offset of offsets) {
      for (const dancer of PROTO_DANCER_IDS) {
        for (const dancerOffset of [0, 1, -1]) {
          it(`${base}(offset=${offset}) is symmetric for ${makeDancerId(dancer, dancerOffset)}`, () => {
            const target = resolveRelationship({ base, offset }, dancer);
            const reverse = resolveRelationship({ base, offset }, target);
            const { proto: reverseProto } = parseDancerId(reverse);
            expect(reverseProto).toBe(dancer);
          });
        }
      }
    }
  }
});

describe('getRelationship', () => {
  it('returns right values in simple cases', () => {
    expect(getRelationship('up_lark_10', 'up_lark_13')).toBeUndefined();
    expect(getRelationship('up_lark_10', 'up_robin_13')).toEqual({ base: 'partner', offset: -3 });
    expect(getRelationship('up_lark_10', 'down_lark_13')).toEqual({ base: 'opposite', offset: 3 });
    expect(getRelationship('up_lark_10', 'down_robin_13')).toEqual({ base: 'neighbor', offset: 3 });

    expect(getRelationship('down_robin_10', 'up_lark_13')).toEqual({ base: 'neighbor', offset: -3 });
    expect(getRelationship('down_robin_10', 'up_robin_13')).toEqual({ base: 'opposite', offset: -3 });
    expect(getRelationship('down_robin_10', 'down_lark_13')).toEqual({ base: 'partner', offset: -3 });
    expect(getRelationship('down_robin_10', 'down_robin_13')).toBeUndefined();
  });
});