import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, DropHandsTargetSchema } from '../types';
import type { DropHandsTarget, AtomicInstruction } from '../types';
import { SubFormProps, SaveCancelButtons, useInstructionPreview, DROP_TARGET_OPTIONS, DROP_TARGET_LABELS } from '../fieldUtils';

export function DropHandsFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'drop_hands' }> }) {
  const [dropTarget, setDropTarget] = useState<DropHandsTarget>(initial?.target ?? 'neighbor');

  useInstructionPreview(onPreview, () => ({ id, beats: 0, type: 'drop_hands', target: dropTarget }), [id, dropTarget]);

  function save() {
    onSave(InstructionSchema.parse({ id, beats: 0, type: 'drop_hands', target: dropTarget }));
  }

  return (<>
    <label>
      Drop
      <SearchableDropdown options={DROP_TARGET_OPTIONS} value={dropTarget} onChange={v => setDropTarget(DropHandsTargetSchema.parse(v))} getLabel={v => DROP_TARGET_LABELS[v] ?? v} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
