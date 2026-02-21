import { useState } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import { InstructionSchema } from '../types';
import type { AtomicInstruction } from '../types';
import type { SubFormProps } from '../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats, parseDirection, directionToText, DIR_OPTIONS } from '../fieldUtils';

export function StepFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'step' }> }) {
  const [dirText, setDirText] = useState(initial ? directionToText(initial.direction) : '');
  const [distance, setDistance] = useState(initial ? String(initial.distance) : '0.5');
  const [facingText, setFacingText] = useState(initial ? directionToText(initial.facing) : 'forward');
  // UI shows rotations (1 = full turn); internally stored as radians
  const [facingOffsetRot, setFacingOffsetRot] = useState(initial ? String(initial.facingOffset / (2 * Math.PI)) : '0');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('step'));

  const facingOffsetRad = (Number(facingOffsetRot) || 0) * 2 * Math.PI;

  useInstructionPreview(onPreview, () => {
    const dir = parseDirection(dirText) ?? { kind: 'direction' as const, value: 'up' as const };
    const facing = parseDirection(facingText) ?? { kind: 'direction' as const, value: 'forward' as const };
    return { id, type: 'step', beats: Number(beats) || 0, direction: dir, distance: Number(distance) || 0, facing, facingOffset: facingOffsetRad };
  }, [id, dirText, distance, facingText, facingOffsetRot, beats]);

  function save() {
    const dir = parseDirection(dirText) ?? { kind: 'direction' as const, value: 'up' as const };
    const facing = parseDirection(facingText) ?? { kind: 'direction' as const, value: 'forward' as const };
    onSave(InstructionSchema.parse({ id, type: 'step', beats: Number(beats) || 0, direction: dir, distance: Number(distance) || 0, facing, facingOffset: facingOffsetRad }));
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
      Facing
      <SearchableDropdown options={DIR_OPTIONS} value={facingText} onChange={setFacingText} placeholder="e.g. across, partner" />
    </label>
    <label>
      Facing offset (rot)
      <input type="text" inputMode="decimal" value={facingOffsetRot} onChange={e => setFacingOffsetRot(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}
