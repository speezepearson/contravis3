import { useRef } from 'react';

interface DragHandleProps {
  value: number;
  step: number;
  pixelsPerStep?: number;
  onDrag: (newValue: number) => void;
}

export function DragHandle({ value, step, pixelsPerStep = 50, onDrag }: DragHandleProps) {
  const startRef = useRef<{ x: number; value: number } | null>(null);

  return (
    <span
      className="number-drag-handle"
      onPointerDown={e => {
        e.preventDefault();
        startRef.current = { x: e.clientX, value };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (!startRef.current) return;
        const dx = e.clientX - startRef.current.x;
        const steps = Math.round(dx / pixelsPerStep);
        const newValue = startRef.current.value + steps * step;
        onDrag(Math.round(newValue / step) * step);
      }}
      onPointerUp={() => { startRef.current = null; }}
      onPointerCancel={() => { startRef.current = null; }}
      style={{ touchAction: 'none' }}
    />
  );
}
