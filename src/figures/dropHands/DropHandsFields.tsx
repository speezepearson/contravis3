import { InstructionSchema, BaseRelationshipSchema } from '../../types';
import type { AtomicInstruction, DropHandsTarget } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { DROP_TARGET_OPTIONS, DROP_TARGET_LABELS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

function dropTargetToString(target: DropHandsTarget): string {
  if (typeof target === 'string') return target;
  return target.base;
}

function parseDropTarget(s: string): DropHandsTarget {
  if (s === 'left' || s === 'right' || s === 'both') return s;
  return { base: BaseRelationshipSchema.parse(s), offset: 0 };
}

export function DropHandsFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'drop_hands' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, beats: 0, type: 'drop_hands', target: instruction.target, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={DROP_TARGET_OPTIONS} value={dropTargetToString(instruction.target)} onChange={v => tryCommit({ target: parseDropTarget(v) })} getLabel={v => DROP_TARGET_LABELS[v] ?? v} />
  </>);
}
