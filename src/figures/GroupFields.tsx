import { useState } from 'react';
import { InstructionSchema } from '../types';
import type { Instruction } from '../types';
import type { SubFormProps } from '../fieldUtils';
import { SaveCancelButtons } from '../fieldUtils';

export function GroupFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<Instruction, { type: 'group' }> }) {
  const [label, setLabel] = useState(initial?.label ?? '');

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'group', label: label || 'Untitled', instructions: initial?.instructions ?? [] }));
  }

  return (<>
    <label>
      Label
      <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Allemande figure" />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
