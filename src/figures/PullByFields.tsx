import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, RelationshipSchema, HandSchema } from '../types';
import type { Relationship, AtomicInstruction } from '../types';
import { SubFormProps, SaveCancelButtons, useInstructionPreview, defaultBeats, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, HAND_OPTIONS } from '../fieldUtils';

export function PullByFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'pull_by' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [hand, setHand] = useState<'left' | 'right'>(initial?.hand ?? 'right');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('pull_by'));

  useInstructionPreview(onPreview, () => ({ id, type: 'pull_by', beats: Number(beats) || 0, relationship, hand }), [id, relationship, hand, beats]);

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'pull_by', beats: Number(beats) || 0, relationship, hand }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Hand
      <SearchableDropdown options={HAND_OPTIONS} value={hand} onChange={v => setHand(HandSchema.parse(v))} getLabel={v => v} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
