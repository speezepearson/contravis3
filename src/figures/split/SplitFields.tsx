import { useState } from 'react';
import { InstructionSchema, splitWithLists, splitLists } from '../../types';
import type { Instruction, SplitBy } from '../../types';
import { z } from 'zod';
import type { SubFormProps } from '../../fieldUtils';
import { SPLIT_BY_OPTIONS, SPLIT_BY_LABELS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

export function SplitFields({ instruction, onChange }: SubFormProps & { instruction: Extract<Instruction, { type: 'split' }> }) {
  const [splitBy, setSplitBy] = useState<SplitBy['by']>(instruction.by);

  function tryCommit(by: SplitBy['by']) {
    const [listA, listB] = splitLists(instruction);
    const result = InstructionSchema.safeParse({ id: instruction.id, type: 'split', ...splitWithLists(by, listA, listB) });
    if (result.success) onChange(result.data);
  }

  return (<>
    {' by '}
    <InlineDropdown options={SPLIT_BY_OPTIONS} value={splitBy} onChange={v => { const by = z.enum(['role', 'position']).parse(v); setSplitBy(by); tryCommit(by); }} getLabel={v => SPLIT_BY_LABELS[v] ?? v} />
  </>);
}
