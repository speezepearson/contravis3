import { describe, it, expect } from 'vitest';
import { resolveRelationship, PROTO_DANCER_IDS } from './generateUtils';
import { BaseRelationshipSchema, parseDancerId } from './types';
import type { BaseRelationship } from './types';

describe('resolveRelationship symmetry', () => {
  const bases: BaseRelationship[] = BaseRelationshipSchema.options;
  const offsets = [-2, -1, 0, 1, 2];

  for (const base of bases) {
    for (const offset of offsets) {
      for (const dancer of PROTO_DANCER_IDS) {
        it(`${base}(offset=${offset}) is symmetric for ${dancer}`, () => {
          const target = resolveRelationship({ base, offset }, dancer);
          const reverse = resolveRelationship({ base, offset }, target);
          const { proto: reverseProto } = parseDancerId(reverse);
          expect(reverseProto).toBe(dancer);
        });
      }
    }
  }
});
