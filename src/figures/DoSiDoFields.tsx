import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, RelationshipSchema } from '../types';
import type { Relationship, AtomicInstruction } from '../types';
import type { SubFormProps } from '../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS } from '../fieldUtils';

export function DoSiDoFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'do_si_do' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('do_si_do'));

  useInstructionPreview(onPreview, () => ({ id, type: 'do_si_do', beats: Number(beats) || 0, relationship, rotations: Number(rotations) || 1 }), [id, relationship, rotations, beats]);

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'do_si_do', beats: Number(beats) || 0, relationship, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Rotations
      <input type="text" inputMode="decimal" value={rotations} onChange={e => setRotations(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
