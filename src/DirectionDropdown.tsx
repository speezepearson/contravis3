import { InlineDropdown } from './InlineDropdown';
import { parseDirection, directionToText, DIR_OPTIONS } from './fieldUtils';
import type { RelativeDirection } from './types';

export function DirectionDropdown({ value, onChange, onInvalid, placeholder }: {
  value: RelativeDirection;
  onChange: (value: RelativeDirection) => void;
  onInvalid?: () => void;
  placeholder?: string;
}) {
  return (
    <InlineDropdown
      options={DIR_OPTIONS}
      value={directionToText(value)}
      onChange={v => {
        const dir = parseDirection(v);
        if (dir) onChange(dir);
        else onInvalid?.();
      }}
      placeholder={placeholder ?? 'e.g. across'}
    />
  );
}
