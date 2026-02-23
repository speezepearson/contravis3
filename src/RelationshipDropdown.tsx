import { useContext, useMemo } from 'react';
import { InlineDropdown } from './InlineDropdown';
import { decodeRelationship, relationshipOptionLabel } from './fieldUtils';
import { RelationshipHighlightContext } from './RelationshipHighlightContext';
import { useInstructionEdit } from './InstructionEditContext';
import { BaseRelationshipSchema, dancerPosition } from './types';
import { resolveRelationship } from './generateUtils';

function relationshipTiebreakRank(base: string, offset: number): number {
  if (base === 'partner' && offset === 0) return 0;
  if (base === 'neighbor') return 1;
  if (base === 'opposite') return 2;
  // partner with nonzero offset (shadow)
  return 3;
}

export function RelationshipDropdown({ options, value, onChange }: {
  options: string[];
  value: { base: string; offset: number };
  onChange: (value: { base: string; offset: number }) => void;
}) {
  const highlightRelationship = useContext(RelationshipHighlightContext);
  const { dancerStates } = useInstructionEdit();

  const sortedOptions = useMemo(() => {
    if (!dancerStates) return options;
    const larkState = dancerStates['up_lark_0'];
    return [...options].sort((a, b) => {
      const relA = decodeRelationship(a);
      const relB = decodeRelationship(b);
      const baseA = BaseRelationshipSchema.safeParse(relA.base);
      const baseB = BaseRelationshipSchema.safeParse(relB.base);
      if (!baseA.success || !baseB.success) return 0;
      const targetA = dancerPosition(resolveRelationship({ base: baseA.data, offset: relA.offset }, 'up_lark_0'), dancerStates);
      const targetB = dancerPosition(resolveRelationship({ base: baseB.data, offset: relB.offset }, 'up_lark_0'), dancerStates);
      const distA = larkState.pos.subtract(targetA.pos).length();
      const distB = larkState.pos.subtract(targetB.pos).length();
      if (Math.abs(distA - distB) > 1e-6) return distA - distB;
      return relationshipTiebreakRank(relA.base, relA.offset) - relationshipTiebreakRank(relB.base, relB.offset);
    });
  }, [options, dancerStates]);

  return (
    <InlineDropdown
      options={sortedOptions}
      value={value.base + ':' + value.offset}
      onChange={v => onChange(decodeRelationship(v))}
      getLabel={relationshipOptionLabel}
      onHighlight={highlightRelationship}
    />
  );
}
