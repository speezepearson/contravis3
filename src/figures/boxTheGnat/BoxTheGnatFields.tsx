import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, RelationshipSchema } from '../../types';
import type { Relationship, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS } from '../../fieldUtils';

export function BoxTheGnatFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'box_the_gnat' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('box_the_gnat'));

  useInstructionPreview(onPreview, () => ({ id, type: 'box_the_gnat', beats: Number(beats) || 0, relationship }), [id, relationship, beats]);

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'box_the_gnat', beats: Number(beats) || 0, relationship }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
