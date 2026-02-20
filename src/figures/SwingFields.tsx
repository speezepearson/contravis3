import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, RelationshipSchema } from '../types';
import type { Relationship, AtomicInstruction } from '../types';
import { SubFormProps, SaveCancelButtons, useInstructionPreview, defaultBeats, parseDirection, directionToText, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, DIR_OPTIONS } from '../fieldUtils';

export function SwingFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'swing' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [endFacingText, setEndFacingText] = useState(initial ? directionToText(initial.endFacing) : 'across');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('swing'));

  useInstructionPreview(onPreview, () => {
    const endFacing = parseDirection(endFacingText) ?? { kind: 'direction' as const, value: 'across' as const };
    return { id, type: 'swing', beats: Number(beats) || 0, relationship, endFacing };
  }, [id, relationship, endFacingText, beats]);

  function save() {
    const endFacing = parseDirection(endFacingText) ?? { kind: 'direction' as const, value: 'across' as const };
    onSave(InstructionSchema.parse({ id, type: 'swing', beats: Number(beats) || 0, relationship, endFacing }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      End facing
      <SearchableDropdown options={DIR_OPTIONS} value={endFacingText} onChange={setEndFacingText} placeholder="e.g. across, up" />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
