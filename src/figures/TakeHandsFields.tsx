import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, RelationshipSchema, TakeHandSchema } from '../types';
import type { Relationship, TakeHand, AtomicInstruction } from '../types';
import { SubFormProps, SaveCancelButtons, useInstructionPreview, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, TAKE_HAND_OPTIONS } from '../fieldUtils';

export function TakeHandsFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'take_hands' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [hand, setHand] = useState<TakeHand>(initial?.hand ?? 'right');

  useInstructionPreview(onPreview, () => ({ id, beats: 0, type: 'take_hands', relationship, hand }), [id, relationship, hand]);

  function save() {
    onSave(InstructionSchema.parse({ id, beats: 0, type: 'take_hands', relationship, hand }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Hand
      <SearchableDropdown options={TAKE_HAND_OPTIONS} value={hand} onChange={v => setHand(TakeHandSchema.parse(v))} getLabel={v => v} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
