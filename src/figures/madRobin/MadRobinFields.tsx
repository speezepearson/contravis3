import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import { z } from 'zod';
import type { SubFormProps } from '../../fieldUtils';
import { DragHandle } from '../../DragHandle';

const MAD_ROBIN_DIR_OPTIONS = ['larks_in_middle', 'robins_in_middle'];
const MAD_ROBIN_DIR_LABELS: Record<string, string> = { larks_in_middle: 'larks in middle', robins_in_middle: 'robins in middle' };
const MAD_ROBIN_WITH_OPTIONS = ['larks_left', 'robins_left'];
const MAD_ROBIN_WITH_LABELS: Record<string, string> = { larks_left: "larks' left", robins_left: "robins' left" };

export function MadRobinFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'mad_robin' }> }) {
  const { id } = instruction;
  const [dir, setDir] = useState<'larks_in_middle' | 'robins_in_middle'>(instruction.dir);
  const [withDir, setWithDir] = useState<'larks_left' | 'robins_left'>(instruction.with);
  const [rotations, setRotations] = useState(String(instruction.rotations));

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'mad_robin', beats: instruction.beats, dir, with: withDir, rotations: Number(rotations), ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <SearchableDropdown options={MAD_ROBIN_DIR_OPTIONS} value={dir} onChange={v => { const d = z.enum(['larks_in_middle', 'robins_in_middle']).parse(v); setDir(d); tryCommit({ dir: d }); }} getLabel={v => MAD_ROBIN_DIR_LABELS[v] ?? v} />
    {' '}
    <SearchableDropdown options={MAD_ROBIN_WITH_OPTIONS} value={withDir} onChange={v => { const w = z.enum(['larks_left', 'robins_left']).parse(v); setWithDir(w); tryCommit({ with: w }); }} getLabel={v => MAD_ROBIN_WITH_LABELS[v] ?? v} />
    {' '}
    <input type="text" inputMode="decimal" className="inline-number" value={rotations} onChange={e => { setRotations(e.target.value); tryCommit({ rotations: Number(e.target.value) }); }} />
    <DragHandle value={Number(rotations) || 0} step={0.25} onDrag={n => { setRotations(String(n)); tryCommit({ rotations: n }); }} />
    {'x'}
  </>);
}
