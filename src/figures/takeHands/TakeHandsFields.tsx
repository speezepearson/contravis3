import { InstructionSchema, TakeHandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_RELATIONSHIP_OPTIONS, TAKE_HAND_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { RelationshipDropdown } from '../../RelationshipDropdown';

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
    <RelationshipDropdown options={FULL_RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={rel => tryCommit({ relationship: rel })} />
  </>);
}
