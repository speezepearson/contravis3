import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, RelationshipSchema, RoleSchema } from '../types';
import type { Relationship, Role, AtomicInstruction } from '../types';
import type { SubFormProps } from '../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats, parseDirection, directionToText, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, DIR_OPTIONS, ROLE_OPTIONS } from '../fieldUtils';

export function GiveAndTakeIntoSwingFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [role, setRole] = useState<Role>(initial?.role ?? 'lark');
  const [endFacingText, setEndFacingText] = useState(initial ? directionToText(initial.endFacing) : 'across');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('give_and_take_into_swing'));

  useInstructionPreview(onPreview, () => {
    const endFacing = parseDirection(endFacingText) ?? { kind: 'direction' as const, value: 'across' as const };
    return { id, type: 'give_and_take_into_swing', beats: Number(beats) || 0, relationship, role, endFacing };
  }, [id, relationship, role, endFacingText, beats]);

  function save() {
    const endFacing = parseDirection(endFacingText) ?? { kind: 'direction' as const, value: 'across' as const };
    onSave(InstructionSchema.parse({ id, type: 'give_and_take_into_swing', beats: Number(beats) || 0, relationship, role, endFacing }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Who draws
      <SearchableDropdown options={ROLE_OPTIONS} value={role} onChange={v => setRole(RoleSchema.parse(v))} getLabel={v => v} />
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
