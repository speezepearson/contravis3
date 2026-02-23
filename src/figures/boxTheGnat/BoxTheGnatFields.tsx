import { useContext } from 'react';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_FOIL_RELATIONSHIP_OPTIONS, encodeRelationship, decodeRelationship, relationshipOptionLabel } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { RelationshipHighlightContext } from '../../RelationshipHighlightContext';

export function BoxTheGnatFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'box_the_gnat' }> }) {
  const highlightRelationship = useContext(RelationshipHighlightContext);
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'box_the_gnat', beats: instruction.beats, relationship: instruction.relationship, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'with your '}
    <InlineDropdown options={FULL_FOIL_RELATIONSHIP_OPTIONS} value={encodeRelationship(instruction.relationship)} onChange={v => tryCommit({ relationship: decodeRelationship(v) })} getLabel={relationshipOptionLabel} onHighlight={highlightRelationship} />
  </>);
}
