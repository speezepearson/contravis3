import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, RelationshipSchema, HandSchema } from '../../types';
import type { Relationship, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, HAND_OPTIONS } from '../../fieldUtils';

export function AllemandeFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'allemande' }> }) {
  const { id } = instruction;
  const [relationship, setRelationship] = useState<Relationship>(instruction.relationship);
  const [handedness, setHandedness] = useState<'left' | 'right'>(instruction.handedness);
  const [rotations, setRotations] = useState(String(instruction.rotations));

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'allemande', beats: instruction.beats, relationship, handedness, rotations: Number(rotations), ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <SearchableDropdown options={HAND_OPTIONS} value={handedness} onChange={v => { const h = HandSchema.parse(v); setHandedness(h); tryCommit({ handedness: h }); }} getLabel={v => v} />
    {' '}
    <input type="text" inputMode="decimal" className="inline-number" value={rotations} onChange={e => { setRotations(e.target.value); tryCommit({ rotations: Number(e.target.value) }); }} />
    {'x with your '}
    <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => { const r = RelationshipSchema.parse(v); setRelationship(r); tryCommit({ relationship: r }); }} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
  </>);
}
