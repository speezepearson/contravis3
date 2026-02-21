import { useState } from 'react';
import { InstructionSchema } from '../../types';
import type { Instruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';

export function GroupFields({ instruction, onChange }: SubFormProps & { instruction: Extract<Instruction, { type: 'group' }> }) {
  const [label, setLabel] = useState(instruction.label);

  function tryCommit(lbl: string) {
    const result = InstructionSchema.safeParse({ id: instruction.id, type: 'group', label: lbl || 'Untitled', instructions: instruction.instructions });
    if (result.success) onChange(result.data);
  }

  return (<>
    {' "'}
    <input type="text" className="inline-text" value={label} onChange={e => { setLabel(e.target.value); tryCommit(e.target.value); }} placeholder="Untitled" />
    {'"'}
  </>);
}
