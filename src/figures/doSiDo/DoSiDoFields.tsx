import { useState } from 'react';
import { InstructionSchema, RelationshipSchema } from '../../types';
import type { Relationship, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

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
    <InlineNumber value={rotations} onTextChange={v => { setRotations(v); tryCommit({ rotations: Number(v) }); }} onDrag={n => { setRotations(String(n)); tryCommit({ rotations: n }); }} step={0.25} suffix="x" />
    {' with your '}
    <InlineDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => { const r = RelationshipSchema.parse(v); setRelationship(r); tryCommit({ relationship: r }); }} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
  </>);
}
