import { InstructionSchema } from '../../types';
import type { AtomicInstruction, OffsetRelativeDirection } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { InlineNumber } from '../../InlineNumber';
import { InlineDirection } from '../../InlineDirection';

export function StepFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'step' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'step', beats: instruction.beats, direction: instruction.direction, distance: instruction.distance, facing: instruction.facing, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDirection value={instruction.direction} onChange={(direction: OffsetRelativeDirection) => tryCommit({ direction })} label="Direction" />
    {' '}
    <InlineNumber value={String(instruction.distance)} onTextChange={v => tryCommit({ distance: Number(v) })} onDrag={n => tryCommit({ distance: n })} step={0.5} suffix="m" />
    {' facing '}
    <InlineDirection value={instruction.facing} onChange={(facing: OffsetRelativeDirection) => tryCommit({ facing })} label="Facing" />
  </>);
}
