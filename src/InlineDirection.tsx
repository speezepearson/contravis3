import { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { OffsetRelativeDirection } from './types';
import { parseDirection, directionToText, DIR_OPTIONS } from './fieldUtils';
import SearchableDropdown from './SearchableDropdown';
import type { SearchableDropdownHandle } from './SearchableDropdown';
import { useInstructionEdit } from './InstructionEditContext';

function displayText(dirText: string, offsetRot: number): string {
  if (offsetRot === 0) return dirText;
  const abs = Math.abs(offsetRot);
  const dir = offsetRot > 0 ? 'cw' : 'ccw';
  return `${dirText} + ${abs} rot ${dir}`;
}

interface Props {
  value: OffsetRelativeDirection;
  onChange: (value: OffsetRelativeDirection) => void;
  label?: string;
}

export function InlineDirection({ value, onChange, label = 'Direction' }: Props) {
  const [open, setOpen] = useState(false);
  const [editOffsetRot, setEditOffsetRot] = useState('');
  const dropdownRef = useRef<SearchableDropdownHandle>(null);
  const { onPopoverOpen } = useInstructionEdit();

  function handleOpenChange(next: boolean) {
    if (next) {
      setEditOffsetRot(String(value.offsetRad / (2 * Math.PI)));
      onPopoverOpen?.();
    }
    setOpen(next);
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => dropdownRef.current?.focus());
    }
  }, [open]);

  function handleDirSelect(v: string) {
    const dir = parseDirection(v);
    if (dir) onChange({ ...value, dir });
  }

  function handleOffsetChange(v: string) {
    setEditOffsetRot(v);
    const n = Number(v) || 0;
    onChange({ ...value, offsetRad: n * 2 * Math.PI });
  }

  const dirText = directionToText(value.dir);
  const offsetRot = value.offsetRad / (2 * Math.PI);

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <span className="inline-value" tabIndex={0} role="button">
          {displayText(dirText, offsetRot)}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover-content popover-facing-compound" sideOffset={4} align="start">
          <div className="popover-facing-row">
            <label className="popover-facing-label">{label}</label>
            <SearchableDropdown
              ref={dropdownRef}
              options={DIR_OPTIONS}
              value={dirText}
              onChange={handleDirSelect}
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
              onKeyDown={e => { if (e.key === 'Enter') setOpen(false); }}
            />
            <span className="popover-facing-suffix">rot</span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
