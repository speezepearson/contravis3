import { useState } from 'react';
import { InstructionSchema, RelationshipSchema, TakeHandSchema } from '../../types';
import type { Relationship, TakeHand, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, TAKE_HAND_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

export function TakeHandsFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'take_hands' }> }) {
  const { id } = instruction;
  const [relationship, setRelationship] = useState<Relationship>(instruction.relationship);
  const [hand, setHand] = useState<TakeHand>(instruction.hand);

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, beats: 0, type: 'take_hands', relationship, hand, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={TAKE_HAND_OPTIONS} value={hand} onChange={v => { const h = TakeHandSchema.parse(v); setHand(h); tryCommit({ hand: h }); }} getLabel={v => v} />
    {' with your '}
    <InlineDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => { const r = RelationshipSchema.parse(v); setRelationship(r); tryCommit({ relationship: r }); }} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
  </>);
}
