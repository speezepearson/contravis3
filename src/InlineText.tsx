import { useState, useRef, useEffect } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Input } from '@/components/ui/input';

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
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <span
          className={`inline-value${!value ? ' inline-value-placeholder' : ''}`}
          tabIndex={0}
          role="button"
        >
          {displayText}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="popover-content" sideOffset={4} align="start">
          <Input
            ref={inputRef}
            type="text"
            className="w-[14em]"
            value={editValue}
            onChange={e => { setEditValue(e.target.value); onChange(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter') setOpen(false); }}
            placeholder={placeholder}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
