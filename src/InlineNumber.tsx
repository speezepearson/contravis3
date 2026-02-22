import { useState, useRef, useCallback, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';

interface Props {
  value: string;
  onTextChange: (value: string) => void;
  onDrag: (newValue: number) => void;
  step: number;
  pixelsPerStep?: number;
  suffix?: string;
}

export function InlineNumber({ value, onTextChange, onDrag, step, pixelsPerStep = 50, suffix }: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; value: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (open) return;
    e.preventDefault();
    dragRef.current = { x: e.clientX, value: Number(value) || 0, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [open, value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    if (Math.abs(dx) > 3) dragRef.current.moved = true;
    const steps = Math.round(dx / pixelsPerStep);
    const newValue = dragRef.current.value + steps * step;
    onDrag(Math.round(newValue / step) * step);
  }, [onDrag, step, pixelsPerStep]);

  const handlePointerUp = useCallback(() => {
    const wasDrag = dragRef.current?.moved ?? false;
    dragRef.current = null;
    if (!wasDrag) {
      setOpen(true);
    }
  }, []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <span
          className="inline-value inline-value-number"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { dragRef.current = null; }}
          style={{ touchAction: 'none' }}
        >
          {value}{suffix ?? ''}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover-content" sideOffset={4} align="start">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            className="popover-number-input"
            value={value}
            onChange={e => onTextChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setOpen(false); }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
