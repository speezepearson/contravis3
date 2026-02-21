import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, RelationshipSchema } from '../../types';
import type { Relationship, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS } from '../../fieldUtils';

export function DoSiDoFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'do_si_do' }> }) {
  const { id } = instruction;
  const [relationship, setRelationship] = useState<Relationship>(instruction.relationship);
  const [rotations, setRotations] = useState(String(instruction.rotations));

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'do_si_do', beats: instruction.beats, relationship, rotations: Number(rotations), ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <input type="text" inputMode="decimal" className="inline-number" value={rotations} onChange={e => { setRotations(e.target.value); tryCommit({ rotations: Number(e.target.value) }); }} />
    {'x with your '}
    <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => { const r = RelationshipSchema.parse(v); setRelationship(r); tryCommit({ relationship: r }); }} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
  </>);
}
