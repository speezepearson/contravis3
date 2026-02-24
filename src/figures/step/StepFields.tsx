import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { InlineNumber } from '../../InlineNumber';
import { DirectionDropdown } from '../../DirectionDropdown';

export function StepFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'step' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'step', beats: instruction.beats, direction: instruction.direction, distance: instruction.distance, facing: instruction.facing, facingOffset: instruction.facingOffset, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <DirectionDropdown value={instruction.direction} onChange={dir => tryCommit({ direction: dir })} onInvalid={onInvalid} />
    {' '}
    <InlineNumber value={String(instruction.distance)} onTextChange={v => tryCommit({ distance: Number(v) })} onDrag={n => tryCommit({ distance: n })} step={0.05} suffix="m" />
    {' and face '}
    <DirectionDropdown value={instruction.facing} onChange={f => tryCommit({ facing: f })} onInvalid={onInvalid} />
  </>);
}
