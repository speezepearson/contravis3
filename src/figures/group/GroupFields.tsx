import { useState } from 'react';
import { InstructionSchema } from '../../types';
import type { Instruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { InlineText } from '../../InlineText';

export function GroupFields({ instruction, onChange }: SubFormProps & { instruction: Extract<Instruction, { type: 'group' }> }) {
  const [label, setLabel] = useState(instruction.label);

  function tryCommit(lbl: string) {
    const result = InstructionSchema.safeParse({ id: instruction.id, type: 'group', label: lbl || 'Untitled', instructions: instruction.instructions });
    if (result.success) onChange(result.data);
  }

  return (<>
    {' "'}
    <InlineText value={label} onChange={v => { setLabel(v); tryCommit(v); }} placeholder="Untitled" />
    {'"'}
  </>);
}
