import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, RelationshipSchema } from '../../types';
import type { Relationship, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, DIR_OPTIONS } from '../../fieldUtils';

export function SwingFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'swing' }> }) {
  const { id } = instruction;
  const [relationship, setRelationship] = useState<Relationship>(instruction.relationship);
  const [endFacingText, setEndFacingText] = useState(directionToText(instruction.endFacing));
  const [beats, setBeats] = useState(String(instruction.beats));

  function tryCommit(overrides: Record<string, unknown>) {
    const endFacing = overrides.endFacing ?? parseDirection(endFacingText) ?? { kind: 'direction' as const, value: 'across' as const };
    const raw = { id, type: 'swing', beats: Number(beats), relationship, endFacing, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'your '}
    <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => { const r = RelationshipSchema.parse(v); setRelationship(r); tryCommit({ relationship: r }); }} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    {' \u2192 '}
    <SearchableDropdown options={DIR_OPTIONS} value={endFacingText} onChange={v => { setEndFacingText(v); const f = parseDirection(v); if (f) tryCommit({ endFacing: f }); else onInvalid?.(); }} placeholder="e.g. across" />
    {' ('}
    <input type="text" inputMode="decimal" className="inline-number" value={beats} onChange={e => { setBeats(e.target.value); tryCommit({ beats: Number(e.target.value) }); }} />
    {'b)'}
  </>);
}
