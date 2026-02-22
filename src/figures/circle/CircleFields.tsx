import { InstructionSchema, HandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { CIRCLE_DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

export function CircleFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'circle' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'circle', beats: instruction.beats, direction: instruction.direction, rotations: instruction.rotations, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={CIRCLE_DIR_OPTIONS} value={instruction.direction} onChange={v => tryCommit({ direction: HandSchema.parse(v) })} getLabel={v => v} />
    {' '}
    <InlineNumber value={String(instruction.rotations)} onTextChange={v => tryCommit({ rotations: Number(v) })} onDrag={n => tryCommit({ rotations: n })} step={0.25} suffix="x" />
  </>);
}
