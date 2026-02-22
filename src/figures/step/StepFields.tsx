import { useState } from 'react';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

export function StepFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'step' }> }) {
  const { id } = instruction;
  const [dirText, setDirText] = useState(directionToText(instruction.direction));
  const [distance, setDistance] = useState(String(instruction.distance));
  const [facingText, setFacingText] = useState(directionToText(instruction.facing));
  // UI shows rotations (1 = full turn); internally stored as radians
  const [facingOffsetRot, setFacingOffsetRot] = useState(String(instruction.facingOffset / (2 * Math.PI)));

  function tryCommit(overrides: Record<string, unknown>) {
    const dir = overrides.direction ?? parseDirection(dirText) ?? { kind: 'direction' as const, value: 'forward' as const };
    const facing = overrides.facing ?? parseDirection(facingText) ?? { kind: 'direction' as const, value: 'forward' as const };
    const facingOffsetRad = ('facingOffset' in overrides ? overrides.facingOffset : (Number(facingOffsetRot) || 0) * 2 * Math.PI) as number;
    const raw = { id, type: 'step', beats: instruction.beats, direction: dir, distance: Number(distance), facing, facingOffset: facingOffsetRad, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={DIR_OPTIONS} value={dirText} onChange={v => { setDirText(v); const dir = parseDirection(v); if (dir) tryCommit({ direction: dir }); else onInvalid?.(); }} placeholder="e.g. across" />
    {' '}
    <InlineNumber value={distance} onTextChange={v => { setDistance(v); tryCommit({ distance: Number(v) }); }} onDrag={n => { setDistance(String(n)); tryCommit({ distance: n }); }} step={0.5} />
    {' facing '}
    <InlineDropdown options={DIR_OPTIONS} value={facingText} onChange={v => { setFacingText(v); const f = parseDirection(v); if (f) tryCommit({ facing: f }); else onInvalid?.(); }} placeholder="e.g. forward" />
    {'+'}
    <InlineNumber value={facingOffsetRot} onTextChange={v => { setFacingOffsetRot(v); tryCommit({ facingOffset: (Number(v) || 0) * 2 * Math.PI }); }} onDrag={n => { setFacingOffsetRot(String(n)); tryCommit({ facingOffset: n * 2 * Math.PI }); }} step={0.25} suffix="rot" />
  </>);
}
