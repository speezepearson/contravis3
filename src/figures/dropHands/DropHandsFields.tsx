import { useState } from 'react';
import { InstructionSchema, DropHandsTargetSchema } from '../../types';
import type { DropHandsTarget, AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { DROP_TARGET_OPTIONS, DROP_TARGET_LABELS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

export function DropHandsFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'drop_hands' }> }) {
  const { id } = instruction;
  const [dropTarget, setDropTarget] = useState<DropHandsTarget>(instruction.target);

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, beats: 0, type: 'drop_hands', target: dropTarget, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={DROP_TARGET_OPTIONS} value={dropTarget} onChange={v => { const t = DropHandsTargetSchema.parse(v); setDropTarget(t); tryCommit({ target: t }); }} getLabel={v => DROP_TARGET_LABELS[v] ?? v} />
  </>);
}
