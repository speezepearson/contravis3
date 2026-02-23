import { InstructionSchema } from '../../types';
import type { AtomicInstruction, OffsetRelativeDirection } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_FOIL_RELATIONSHIP_OPTIONS } from '../../fieldUtils';
import { RelationshipDropdown } from '../../RelationshipDropdown';
import { InlineDirection } from '../../InlineDirection';

export function SwingFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'swing' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'swing', beats: instruction.beats, relationship: instruction.relationship, endFacing: instruction.endFacing, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'your '}
    <RelationshipDropdown options={FULL_FOIL_RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={rel => tryCommit({ relationship: rel })} />
    {' \u2192 '}
    <InlineDirection value={instruction.endFacing} onChange={(endFacing: OffsetRelativeDirection) => tryCommit({ endFacing })} label="End facing" />
  </>);
}
