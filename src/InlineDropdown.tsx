import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import SearchableDropdown from './SearchableDropdown';
import type { SearchableDropdownHandle } from './SearchableDropdown';

export interface InlineDropdownHandle {
  focus: () => void;
}

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  getLabel?: (value: string) => string;
}

export const InlineDropdown = forwardRef<InlineDropdownHandle, Props>(function InlineDropdown(
  { options, value, onChange, placeholder, getLabel },
  ref,
) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<SearchableDropdownHandle>(null);

  useImperativeHandle(ref, () => ({
    focus: () => setOpen(true),
  }));

  useEffect(() => {
    if (open) {
      // Wait for popover to mount then focus the dropdown input
      requestAnimationFrame(() => dropdownRef.current?.focus());
    }
  }, [open]);

  const displayText = value
    ? (getLabel ? getLabel(value) : value)
    : (placeholder ?? '...');

  function handleChange(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
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
          <SearchableDropdown
            ref={dropdownRef}
            options={options}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            getLabel={getLabel}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
