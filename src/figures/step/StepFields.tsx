import { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';
import SearchableDropdown from '../../SearchableDropdown';
import type { SearchableDropdownHandle } from '../../SearchableDropdown';

function facingDisplayText(facingText: string, offsetRot: number): string {
  if (offsetRot === 0) return facingText;
  const abs = Math.abs(offsetRot);
  const dir = offsetRot > 0 ? 'cw' : 'ccw';
  return `${facingText} + ${abs} rot ${dir}`;
}

export function StepFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'step' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'step', beats: instruction.beats, direction: instruction.direction, distance: instruction.distance, facing: instruction.facing, facingOffset: instruction.facingOffset, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  // Compound facing + offset field
  const [facingOpen, setFacingOpen] = useState(false);
  const [editOffsetRot, setEditOffsetRot] = useState('');
  const dropdownRef = useRef<SearchableDropdownHandle>(null);

  function handleFacingOpenChange(next: boolean) {
    if (next) setEditOffsetRot(String(instruction.facingOffset / (2 * Math.PI)));
    setFacingOpen(next);
  }

  useEffect(() => {
    if (facingOpen) {
      requestAnimationFrame(() => dropdownRef.current?.focus());
    }
  }, [facingOpen]);

  function handleFacingSelect(v: string) {
    const f = parseDirection(v);
    if (f) tryCommit({ facing: f });
    else onInvalid?.();
  }

  function handleOffsetChange(v: string) {
    setEditOffsetRot(v);
    const n = Number(v) || 0;
    tryCommit({ facingOffset: n * 2 * Math.PI });
  }

  const facingText = directionToText(instruction.facing);
  const offsetRot = instruction.facingOffset / (2 * Math.PI);

  return (<>
    <InlineDropdown options={DIR_OPTIONS} value={directionToText(instruction.direction)} onChange={v => { const dir = parseDirection(v); if (dir) tryCommit({ direction: dir }); else onInvalid?.(); }} placeholder="e.g. across" />
    {' '}
    <InlineNumber value={String(instruction.distance)} onTextChange={v => tryCommit({ distance: Number(v) })} onDrag={n => tryCommit({ distance: n })} step={0.5} suffix="m" />
    {' facing '}
    <Popover.Root open={facingOpen} onOpenChange={handleFacingOpenChange}>
      <Popover.Trigger asChild>
        <span className="inline-value" tabIndex={0} role="button">
          {facingDisplayText(facingText, offsetRot)}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover-content popover-facing-compound" sideOffset={4} align="start">
          <div className="popover-facing-row">
            <label className="popover-facing-label">Facing</label>
            <SearchableDropdown
              ref={dropdownRef}
              options={DIR_OPTIONS}
              value={facingText}
              onChange={handleFacingSelect}
            />
          </div>
          <div className="popover-facing-row">
            <label className="popover-facing-label">Offset</label>
            <input
              type="text"
              inputMode="decimal"
              className="popover-number-input"
              value={editOffsetRot}
              onChange={e => handleOffsetChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setFacingOpen(false); }}
            />
            <span className="popover-facing-suffix">rot</span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </>);
}
