import { InstructionSchema, RelationshipSchema, HandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, HAND_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

export function PullByFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'pull_by' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'pull_by', beats: instruction.beats, relationship: instruction.relationship, hand: instruction.hand, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={HAND_OPTIONS} value={instruction.hand} onChange={v => tryCommit({ hand: HandSchema.parse(v) })} getLabel={v => v} />
    {' with your '}
    <InlineDropdown options={RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={v => tryCommit({ relationship: RelationshipSchema.parse(v) })} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
  </>);
}
