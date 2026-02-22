import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

export function StepFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'step' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'step', beats: instruction.beats, direction: instruction.direction, distance: instruction.distance, facing: instruction.facing, facingOffset: instruction.facingOffset, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={DIR_OPTIONS} value={directionToText(instruction.direction)} onChange={v => { const dir = parseDirection(v); if (dir) tryCommit({ direction: dir }); else onInvalid?.(); }} placeholder="e.g. across" />
    {' '}
    <InlineNumber value={String(instruction.distance)} onTextChange={v => tryCommit({ distance: Number(v) })} onDrag={n => tryCommit({ distance: n })} step={0.5} />
    {' facing '}
    <InlineDropdown options={DIR_OPTIONS} value={directionToText(instruction.facing)} onChange={v => { const f = parseDirection(v); if (f) tryCommit({ facing: f }); else onInvalid?.(); }} placeholder="e.g. forward" />
    {'+'}
    <InlineNumber value={String(instruction.facingOffset / (2 * Math.PI))} onTextChange={v => tryCommit({ facingOffset: (Number(v) || 0) * 2 * Math.PI })} onDrag={n => tryCommit({ facingOffset: n * 2 * Math.PI })} step={0.25} suffix="rot" />
  </>);
}
