import { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function InlineText({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(next: boolean) {
    if (next) setEditValue(value);
    setOpen(next);
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  const displayText = value || placeholder || '...';

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <span
          className={`inline-value${!value ? ' inline-value-placeholder' : ''}`}
          tabIndex={0}
          role="button"
        >
          {displayText}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover-content" sideOffset={4} align="start">
          <input
            ref={inputRef}
            type="text"
            className="popover-text-input"
            value={editValue}
            onChange={e => { setEditValue(e.target.value); onChange(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter') setOpen(false); }}
            placeholder={placeholder}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
