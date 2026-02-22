import { InstructionSchema, DropHandsTargetSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { DROP_TARGET_OPTIONS, DROP_TARGET_LABELS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

export function DropHandsFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'drop_hands' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, beats: 0, type: 'drop_hands', target: instruction.target, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={DROP_TARGET_OPTIONS} value={instruction.target} onChange={v => tryCommit({ target: DropHandsTargetSchema.parse(v) })} getLabel={v => DROP_TARGET_LABELS[v] ?? v} />
  </>);
}
