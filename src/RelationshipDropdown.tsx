import { useContext } from 'react';
import { InlineDropdown } from './InlineDropdown';
import { encodeRelationship, decodeRelationship, relationshipOptionLabel } from './fieldUtils';
import { RelationshipHighlightContext } from './RelationshipHighlightContext';

export function RelationshipDropdown({ options, value, onChange }: {
  options: string[];
  value: { base: string; offset: number };
  onChange: (value: { base: string; offset: number }) => void;
}) {
  const highlightRelationship = useContext(RelationshipHighlightContext);
  return (
    <InlineDropdown
      options={options}
      value={encodeRelationship(value)}
      onChange={v => onChange(decodeRelationship(v))}
      getLabel={relationshipOptionLabel}
      onHighlight={highlightRelationship}
    />
  );
}
