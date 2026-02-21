import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema } from '../types';
import type { AtomicInstruction } from '../types';
import type { SubFormProps } from '../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats, parseDirection, directionToText, DIR_OPTIONS } from '../fieldUtils';

export function TurnFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'turn' }> }) {
  const [targetText, setTargetText] = useState(initial ? directionToText(initial.target) : '');
  // UI shows rotations (1 = full turn); internally stored as radians
  const [offsetRot, setOffsetRot] = useState(initial ? String(initial.offset / (2 * Math.PI)) : '0');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('turn'));

  const offsetRad = (Number(offsetRot) || 0) * 2 * Math.PI;

  useInstructionPreview(onPreview, () => {
    const target = parseDirection(targetText) ?? { kind: 'direction' as const, value: 'up' as const };
    return { id, type: 'turn', beats: Number(beats) || 0, target, offset: offsetRad };
  }, [id, targetText, offsetRot, beats]);

  function save() {
    const target = parseDirection(targetText) ?? { kind: 'direction' as const, value: 'up' as const };
    onSave(InstructionSchema.parse({ id, type: 'turn', beats: Number(beats) || 0, target, offset: offsetRad }));
  }

  return (<>
    <label>
      Target
      <SearchableDropdown options={DIR_OPTIONS} value={targetText} onChange={setTargetText} placeholder="e.g. across, partner" />
    </label>
    <label>
      Offset (rot)
      <input type="text" inputMode="decimal" value={offsetRot} onChange={e => setOffsetRot(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
