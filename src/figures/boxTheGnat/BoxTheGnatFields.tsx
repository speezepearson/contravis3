import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, RelationshipSchema } from '../../types';
import type { Relationship, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS } from '../../fieldUtils';

export function BoxTheGnatFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'box_the_gnat' }> }) {
  const { id } = instruction;
  const [relationship, setRelationship] = useState<Relationship>(instruction.relationship);
  const [beats, setBeats] = useState(String(instruction.beats));

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'box_the_gnat', beats: Number(beats), relationship, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'with your '}
    <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => { const r = RelationshipSchema.parse(v); setRelationship(r); tryCommit({ relationship: r }); }} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    {' ('}
    <input type="text" inputMode="decimal" className="inline-number" value={beats} onChange={e => { setBeats(e.target.value); tryCommit({ beats: Number(e.target.value) }); }} />
    {'b)'}
  </>);
}
