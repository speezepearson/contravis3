import { useState } from 'react';
import { InstructionSchema, HandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { CIRCLE_DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

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
    <InlineDropdown options={CIRCLE_DIR_OPTIONS} value={direction} onChange={v => { const d = HandSchema.parse(v); setDirection(d); tryCommit({ direction: d }); }} getLabel={v => v} />
    {' '}
    <InlineNumber value={rotations} onTextChange={v => { setRotations(v); tryCommit({ rotations: Number(v) }); }} onDrag={n => { setRotations(String(n)); tryCommit({ rotations: n }); }} step={0.25} suffix="x" />
  </>);
}
