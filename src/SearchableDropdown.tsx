import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import "./SearchableDropdown.css";

export interface SearchableDropdownHandle {
  focus: () => void;
}

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  getLabel?: (value: string) => string;
}

const SearchableDropdown = forwardRef<SearchableDropdownHandle, Props>(
  function SearchableDropdown(
    { options, value, onChange, placeholder, getLabel },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [searchText, setSearchText] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    const labelOf = (opt: string) => (getLabel ? getLabel(opt) : opt);

    // In label mode, filtering uses internal searchText; in text mode, uses value
    const query = (getLabel ? searchText : value).toLowerCase();
    const filtered = query
      ? options.filter((opt) =>
          new RegExp("\\b" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(
            labelOf(opt).toLowerCase(),
          ),
        )
      : options;

    // What to display in the input
    const inputValue = getLabel
      ? open
        ? searchText
        : value
          ? labelOf(value)
          : ""
      : value;

    // Reset highlight to first item when filtered results change
    const prevFilteredKey = useRef(filtered.join("\0"));
    useEffect(() => {
      const key = filtered.join("\0");
      if (key !== prevFilteredKey.current) {
        prevFilteredKey.current = key;
        setHighlightIndex(filtered.length > 0 ? 0 : -1);
      }
    }, [filtered]);

    // Scroll highlighted item into view
    useEffect(() => {
      if (highlightIndex >= 0 && listRef.current) {
        const item = listRef.current.children[highlightIndex] as
          | HTMLElement
          | undefined;
        if (item?.scrollIntoView) item.scrollIntoView({ block: "nearest" });
      }
    }, [highlightIndex]);

    function handleFocus() {
      setOpen(true);
      if (getLabel) setSearchText("");
      setHighlightIndex(filtered.length > 0 ? 0 : -1);
    }

    function handleClick() {
      if (!open) {
        setOpen(true);
        if (getLabel) setSearchText("");
        setHighlightIndex(options.length > 0 ? 0 : -1);
      }
    }

    function handleBlur(e: React.FocusEvent) {
      // Don't close if focus moved to something inside the container
      if (containerRef.current?.contains(e.relatedTarget as Node)) return;
      setOpen(false);
      setHighlightIndex(-1);
      if (getLabel) {
        setSearchText("");
      } else {
        // Revert to empty if current value isn't a valid option
        if (!options.includes(value)) {
          onChange("");
        }
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length === 0) return;
        setHighlightIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length === 0) return;
        setHighlightIndex(
          (prev) => (prev - 1 + filtered.length) % filtered.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          e.preventDefault();
          selectOption(filtered[highlightIndex]);
        }
        setOpen(false);
        setHighlightIndex(-1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setHighlightIndex(-1);
        if (getLabel) setSearchText("");
      }
    }

    function selectOption(opt: string) {
      onChange(opt);
      setOpen(false);
      setHighlightIndex(-1);
      if (getLabel) setSearchText("");
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (getLabel) {
        setSearchText(e.target.value);
        setOpen(true);
      } else {
        onChange(e.target.value);
        setOpen(true);
      }
    }

    return (
      <div
        className="searchable-dropdown"
        ref={containerRef}
        onBlur={handleBlur}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={handleFocus}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {open && (
          <ul
            className="searchable-dropdown-popover"
            role="listbox"
            ref={listRef}
          >
            {filtered.map((opt, i) => (
              <li
                key={opt}
                role="option"
                aria-selected={i === highlightIndex}
                className={i === highlightIndex ? "highlighted" : ""}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur
                  selectOption(opt);
                }}
              >
                {labelOf(opt)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

export default SearchableDropdown;
