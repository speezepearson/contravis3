import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats, parseDirection, directionToText, DIR_OPTIONS } from '../../fieldUtils';

export function BalanceFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'balance' }> }) {
  const [dirText, setDirText] = useState(initial ? directionToText(initial.direction) : '');
  const [distance, setDistance] = useState(initial ? String(initial.distance) : '0.5');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('balance'));

  useInstructionPreview(onPreview, () => {
    const dir = parseDirection(dirText) ?? { kind: 'direction' as const, value: 'across' as const };
    return { id, type: 'balance', beats: Number(beats) || 0, direction: dir, distance: Number(distance) || 0 };
  }, [id, dirText, distance, beats]);

  function save() {
    const dir = parseDirection(dirText) ?? { kind: 'direction' as const, value: 'across' as const };
    onSave(InstructionSchema.parse({ id, type: 'balance', beats: Number(beats) || 0, direction: dir, distance: Number(distance) || 0 }));
  }

  return (<>
    <label>
      Direction
      <SearchableDropdown options={DIR_OPTIONS} value={dirText} onChange={setDirText} placeholder="e.g. across, partner, 45" />
    </label>
    <label>
      Distance
      <input type="text" inputMode="decimal" value={distance} onChange={e => setDistance(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
