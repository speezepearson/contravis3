import { useContext } from 'react';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import { z } from 'zod';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_FOIL_RELATIONSHIP_OPTIONS, encodeRelationship, decodeRelationship, relationshipOptionLabel } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';
import { RelationshipHighlightContext } from '../../RelationshipHighlightContext';

const MAD_ROBIN_DIR_OPTIONS = ['larks_in_middle', 'robins_in_middle'];
const MAD_ROBIN_DIR_LABELS: Record<string, string> = { larks_in_middle: 'larks in middle', robins_in_middle: 'robins in middle' };

export function MadRobinFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'mad_robin' }> }) {
  const highlightRelationship = useContext(RelationshipHighlightContext);
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'mad_robin', beats: instruction.beats, relationship: instruction.relationship, dir: instruction.dir, rotations: instruction.rotations, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'your '}
    <InlineDropdown options={FULL_FOIL_RELATIONSHIP_OPTIONS} value={encodeRelationship(instruction.relationship)} onChange={v => tryCommit({ relationship: decodeRelationship(v) })} getLabel={relationshipOptionLabel} onHighlight={highlightRelationship} />
    {' '}
    <InlineDropdown options={MAD_ROBIN_DIR_OPTIONS} value={instruction.dir} onChange={v => tryCommit({ dir: z.enum(['larks_in_middle', 'robins_in_middle']).parse(v) })} getLabel={v => MAD_ROBIN_DIR_LABELS[v] ?? v} />
    {' '}
    <InlineNumber value={String(instruction.rotations)} onTextChange={v => tryCommit({ rotations: Number(v) })} onDrag={n => tryCommit({ rotations: n })} step={0.25} suffix="x" />
  </>);
}
