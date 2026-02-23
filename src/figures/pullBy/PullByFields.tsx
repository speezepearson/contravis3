import { InstructionSchema, HandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_RELATIONSHIP_OPTIONS, HAND_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { RelationshipDropdown } from '../../RelationshipDropdown';

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
    <RelationshipDropdown options={FULL_RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={rel => tryCommit({ relationship: rel })} />
  </>);
}
