import { InstructionSchema } from '../../types';
import type { AtomicInstruction, OffsetRelativeDirection } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';
import { InlineFacing } from '../../InlineFacing';

export function StepFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'step' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'step', beats: instruction.beats, direction: instruction.direction, distance: instruction.distance, facing: instruction.facing, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  function handleFacingChange(facing: OffsetRelativeDirection) {
    tryCommit({ facing });
  }

  return (<>
    <InlineDropdown options={DIR_OPTIONS} value={directionToText(instruction.direction)} onChange={v => { const dir = parseDirection(v); if (dir) tryCommit({ direction: dir }); else onInvalid?.(); }} placeholder="e.g. across" />
    {' '}
    <InlineNumber value={String(instruction.distance)} onTextChange={v => tryCommit({ distance: Number(v) })} onDrag={n => tryCommit({ distance: n })} step={0.5} suffix="m" />
    {' facing '}
    <InlineFacing value={instruction.facing} onChange={handleFacingChange} />
  </>);
}
