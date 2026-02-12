import { useState, useRef, useEffect } from 'react';
import './SearchableDropdown.css';

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchableDropdown({ options, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = options.filter(opt =>
    opt.toLowerCase().includes(value.toLowerCase())
  );

  // Reset highlight to first item when filtered results change
  const prevFilteredKey = useRef(filtered.join('\0'));
  useEffect(() => {
    const key = filtered.join('\0');
    if (key !== prevFilteredKey.current) {
      prevFilteredKey.current = key;
      setHighlightIndex(filtered.length > 0 ? 0 : -1);
    }
  }, [filtered]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      if (item?.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  function handleFocus() {
    setOpen(true);
    setHighlightIndex(filtered.length > 0 ? 0 : -1);
  }

  function handleBlur(e: React.FocusEvent) {
    // Don't close if focus moved to something inside the container
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setOpen(false);
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightIndex(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightIndex(prev => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        e.preventDefault();
        onChange(filtered[highlightIndex]);
      }
      setOpen(false);
      setHighlightIndex(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  function selectOption(opt: string) {
    onChange(opt);
    setOpen(false);
    setHighlightIndex(-1);
  }

  return (
    <div
      className="searchable-dropdown"
      ref={containerRef}
      onBlur={handleBlur}
    >
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && (
        <ul className="searchable-dropdown-popover" role="listbox" ref={listRef}>
          {filtered.map((opt, i) => (
            <li
              key={opt}
              role="option"
              aria-selected={i === highlightIndex}
              className={i === highlightIndex ? 'highlighted' : ''}
              onMouseDown={e => {
                e.preventDefault(); // prevent blur
                selectOption(opt);
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
