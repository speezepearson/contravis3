import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema, HandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { CIRCLE_DIR_OPTIONS } from '../../fieldUtils';

export function CircleFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'circle' }> }) {
  const { id } = instruction;
  const [direction, setDirection] = useState<'left' | 'right'>(instruction.direction);
  const [rotations, setRotations] = useState(String(instruction.rotations));

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'circle', beats: instruction.beats, direction, rotations: Number(rotations), ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <SearchableDropdown options={CIRCLE_DIR_OPTIONS} value={direction} onChange={v => { const d = HandSchema.parse(v); setDirection(d); tryCommit({ direction: d }); }} getLabel={v => v} />
    {' '}
    <input type="text" inputMode="decimal" className="inline-number" value={rotations} onChange={e => { setRotations(e.target.value); tryCommit({ rotations: Number(e.target.value) }); }} />
    {'x'}
  </>);
}
