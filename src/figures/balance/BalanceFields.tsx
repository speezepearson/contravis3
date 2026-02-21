import { useState } from 'react';
import SearchableDropdown from '../../SearchableDropdown';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, DIR_OPTIONS } from '../../fieldUtils';

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
    <SearchableDropdown options={DIR_OPTIONS} value={dirText} onChange={v => { setDirText(v); const dir = parseDirection(v); if (dir) tryCommit({ direction: dir }); else onInvalid?.(); }} placeholder="e.g. across" />
    {' '}
    <input type="text" inputMode="decimal" className="inline-number" value={distance} onChange={e => { setDistance(e.target.value); tryCommit({ distance: Number(e.target.value) }); }} />
  </>);
}
