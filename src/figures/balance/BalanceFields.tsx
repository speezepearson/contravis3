import { useState } from 'react';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

export function BalanceFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'balance' }> }) {
  const { id } = instruction;
  const [dirText, setDirText] = useState(directionToText(instruction.direction));
  const [distance, setDistance] = useState(String(instruction.distance));

  function tryCommit(overrides: Record<string, unknown>) {
    const dir = overrides.direction ?? parseDirection(dirText) ?? { kind: 'direction' as const, value: 'across' as const };
    const raw = { id, type: 'balance', beats: instruction.beats, direction: dir, distance: Number(distance), ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={DIR_OPTIONS} value={dirText} onChange={v => { setDirText(v); const dir = parseDirection(v); if (dir) tryCommit({ direction: dir }); else onInvalid?.(); }} placeholder="e.g. across" />
    {' '}
    <InlineNumber value={distance} onTextChange={v => { setDistance(v); tryCommit({ distance: Number(v) }); }} onDrag={n => { setDistance(String(n)); tryCommit({ distance: n }); }} step={0.5} />
  </>);
}
