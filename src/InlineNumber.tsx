import { useState, useRef, useCallback, useEffect } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Input } from '@/components/ui/input';

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
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; value: number; moved: boolean } | null>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) setEditValue(value);
    setOpen(next);
  }, [value]);

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
      handleOpenChange(true);
    }
  }, [handleOpenChange]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Anchor asChild>
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
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="popover-content" sideOffset={4} align="start">
          <Input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            className="w-[6em] text-center tabular-nums"
            value={editValue}
            onChange={e => { setEditValue(e.target.value); onTextChange(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter') setOpen(false); }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
