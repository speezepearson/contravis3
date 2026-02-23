import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => setOpen(true),
  }));

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const labelOf = (opt: string) => getLabel ? getLabel(opt) : opt;

  const displayText = value
    ? labelOf(value)
    : (placeholder ?? '...');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={`inline-value${!value ? ' inline-value-placeholder' : ''}`}
          tabIndex={0}
          role="combobox"
          aria-expanded={open}
        >
          {displayText}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput ref={inputRef} placeholder={placeholder ?? "Search..."} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={labelOf(opt)}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  {labelOf(opt)}
                  <Check
                    className={cn(
                      "ml-auto size-4",
                      value === opt ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
