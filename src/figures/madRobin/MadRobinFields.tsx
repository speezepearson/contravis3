import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import { z } from 'zod';
import type { SubFormProps } from '../../fieldUtils';
import { SaveCancelButtons, useInstructionPreview, defaultBeats } from '../../fieldUtils';

const MAD_ROBIN_DIR_OPTIONS = ['larks_in_middle', 'robins_in_middle'];
const MAD_ROBIN_DIR_LABELS: Record<string, string> = { larks_in_middle: 'larks in middle', robins_in_middle: 'robins in middle' };
const MAD_ROBIN_WITH_OPTIONS = ['larks_left', 'robins_left'];
const MAD_ROBIN_WITH_LABELS: Record<string, string> = { larks_left: "larks' left", robins_left: "robins' left" };

export function MadRobinFields({ id, isEditing, initial, onSave, onCancel, onPreview }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'mad_robin' }> }) {
  const [dir, setDir] = useState<'larks_in_middle' | 'robins_in_middle'>(initial?.dir ?? 'larks_in_middle');
  const [withDir, setWithDir] = useState<'larks_left' | 'robins_left'>(initial?.with ?? 'larks_left');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('mad_robin'));

  useInstructionPreview(onPreview, () => ({ id, type: 'mad_robin', beats: Number(beats) || 0, dir, with: withDir, rotations: Number(rotations) || 1 }), [id, dir, withDir, rotations, beats]);

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'mad_robin', beats: Number(beats) || 0, dir, with: withDir, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      Direction
      <SearchableDropdown options={MAD_ROBIN_DIR_OPTIONS} value={dir} onChange={v => setDir(z.enum(['larks_in_middle', 'robins_in_middle']).parse(v))} getLabel={v => MAD_ROBIN_DIR_LABELS[v] ?? v} />
    </label>
    <label>
      With
      <SearchableDropdown options={MAD_ROBIN_WITH_OPTIONS} value={withDir} onChange={v => setWithDir(z.enum(['larks_left', 'robins_left']).parse(v))} getLabel={v => MAD_ROBIN_WITH_LABELS[v] ?? v} />
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
