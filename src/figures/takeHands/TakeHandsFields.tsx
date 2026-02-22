import { InstructionSchema, RelationshipSchema, TakeHandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, TAKE_HAND_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

export function TakeHandsFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'take_hands' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, beats: 0, type: 'take_hands', relationship: instruction.relationship, hand: instruction.hand, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={TAKE_HAND_OPTIONS} value={instruction.hand} onChange={v => tryCommit({ hand: TakeHandSchema.parse(v) })} getLabel={v => v} />
    {' with your '}
    <InlineDropdown options={RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={v => tryCommit({ relationship: RelationshipSchema.parse(v) })} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
  </>);
}
