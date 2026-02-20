import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, RelationshipSchema, HandSchema } from '../types';
import type { Relationship, AtomicInstruction } from '../types';
import { SubFormProps, SaveCancelButtons, useInstructionPreview, defaultBeats, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, HAND_OPTIONS } from '../fieldUtils';

export function AllemandeFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'allemande' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [handedness, setHandedness] = useState<'left' | 'right'>(initial?.handedness ?? 'right');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('allemande'));

  useInstructionPreview(onPreview, () => ({ id, type: 'allemande', beats: Number(beats) || 0, relationship, handedness, rotations: Number(rotations) || 1 }), [id, relationship, handedness, rotations, beats]);

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'allemande', beats: Number(beats) || 0, relationship, handedness, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Hand
      <SearchableDropdown options={HAND_OPTIONS} value={handedness} onChange={v => setHandedness(HandSchema.parse(v))} getLabel={v => v} />
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
