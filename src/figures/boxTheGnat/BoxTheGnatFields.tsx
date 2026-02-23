import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_FOIL_RELATIONSHIP_OPTIONS } from '../../fieldUtils';
import { RelationshipDropdown } from '../../RelationshipDropdown';

export function BoxTheGnatFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'box_the_gnat' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'box_the_gnat', beats: instruction.beats, relationship: instruction.relationship, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'with your '}
    <RelationshipDropdown options={FULL_FOIL_RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={rel => tryCommit({ relationship: rel })} />
  </>);
}
