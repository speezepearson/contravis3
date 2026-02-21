import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema, HandSchema } from '../types';
import type { AtomicInstruction } from '../types';
import type { SubFormProps } from '../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats, CIRCLE_DIR_OPTIONS } from '../fieldUtils';

export function CircleFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'circle' }> }) {
  const [direction, setDirection] = useState<'left' | 'right'>(initial?.direction ?? 'left');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('circle'));

  useInstructionPreview(onPreview, () => ({ id, type: 'circle', beats: Number(beats) || 0, direction, rotations: Number(rotations) || 1 }), [id, direction, rotations, beats]);

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'circle', beats: Number(beats) || 0, direction, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      Direction
      <SearchableDropdown options={CIRCLE_DIR_OPTIONS} value={direction} onChange={v => setDirection(HandSchema.parse(v))} getLabel={v => v} />
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
