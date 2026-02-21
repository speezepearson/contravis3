import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, RelationshipSchema, HandSchema } from '../../types';
import type { Relationship, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, HAND_OPTIONS } from '../../fieldUtils';

export function PullByFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'pull_by' }> }) {
  const { id } = instruction;
  const [relationship, setRelationship] = useState<Relationship>(instruction.relationship);
  const [hand, setHand] = useState<'left' | 'right'>(instruction.hand);
  const [beats, setBeats] = useState(String(instruction.beats));

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'pull_by', beats: Number(beats), relationship, hand, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <SearchableDropdown options={HAND_OPTIONS} value={hand} onChange={v => { const h = HandSchema.parse(v); setHand(h); tryCommit({ hand: h }); }} getLabel={v => v} />
    {' with your '}
    <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => { const r = RelationshipSchema.parse(v); setRelationship(r); tryCommit({ relationship: r }); }} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    {' ('}
    <input type="text" inputMode="decimal" className="inline-number" value={beats} onChange={e => { setBeats(e.target.value); tryCommit({ beats: Number(e.target.value) }); }} />
    {'b)'}
  </>);
}
