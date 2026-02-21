import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, splitWithLists, splitLists } from '../../types';
import type { Instruction, SplitBy } from '../../types';
import { z } from 'zod';
import type { SubFormProps } from '../../fieldUtils';
import { SaveCancelButtons, SPLIT_BY_OPTIONS, SPLIT_BY_LABELS } from '../../fieldUtils';

export function SplitFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<Instruction, { type: 'split' }> }) {
  const [splitBy, setSplitBy] = useState<SplitBy['by']>(initial?.by ?? 'role');

  function save() {
    const [listA, listB] = initial ? splitLists(initial) : [[], []];
    onSave(InstructionSchema.parse({ id, type: 'split', ...splitWithLists(splitBy, listA, listB) }));
  }

  return (<>
    <label>
      Split by
      <SearchableDropdown options={SPLIT_BY_OPTIONS} value={splitBy} onChange={v => setSplitBy(z.enum(['role', 'position']).parse(v))} getLabel={v => SPLIT_BY_LABELS[v] ?? v} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
