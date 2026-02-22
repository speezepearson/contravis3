import { InstructionSchema, RelationshipSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

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
    <InlineDropdown options={RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={v => tryCommit({ relationship: RelationshipSchema.parse(v) })} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
  </>);
}
