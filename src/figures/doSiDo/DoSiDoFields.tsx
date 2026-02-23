import { useContext } from 'react';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_RELATIONSHIP_OPTIONS, encodeRelationship, decodeRelationship, relationshipOptionLabel } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';
import { RelationshipHighlightContext } from '../../RelationshipHighlightContext';

export function DoSiDoFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'do_si_do' }> }) {
  const highlightRelationship = useContext(RelationshipHighlightContext);
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'do_si_do', beats: instruction.beats, relationship: instruction.relationship, rotations: instruction.rotations, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineNumber value={String(instruction.rotations)} onTextChange={v => tryCommit({ rotations: Number(v) })} onDrag={n => tryCommit({ rotations: n })} step={0.25} suffix="x" />
    {' with your '}
    <InlineDropdown options={FULL_RELATIONSHIP_OPTIONS} value={encodeRelationship(instruction.relationship)} onChange={v => tryCommit({ relationship: decodeRelationship(v) })} getLabel={relationshipOptionLabel} onHighlight={highlightRelationship} />
  </>);
}
