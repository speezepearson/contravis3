import { useEffect } from 'react';
import { InstructionSchema, RelativeDirectionSchema } from './types';
import type { Instruction, Relationship, RelativeDirection, DropHandsTarget, Role, InstructionId } from './types';

// --- Shared sub-form types and components ---

export interface SubFormProps {
  id: InstructionId;
  isEditing: boolean;
  onSave: (instr: Instruction) => void;
  onCancel: () => void;
  onPreview?: (instr: Instruction | null) => void;
}

export function SaveCancelButtons({ isEditing, onSave, onCancel }: { isEditing: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="builder-buttons">
      <button className="add-btn" onClick={onSave}>{isEditing ? 'Save' : 'Add'}</button>
      <button className="cancel-btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/** Hook that tries to build an instruction from current form state and calls onPreview. */
export function useInstructionPreview(
  onPreview: ((instr: Instruction | null) => void) | undefined,
  builder: () => Record<string, unknown>,
  deps: unknown[],
) {
  useEffect(() => {
    if (!onPreview) return;
    try {
      onPreview(InstructionSchema.parse(builder()));
    } catch {
      onPreview(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPreview, ...deps]);
}

export function defaultBeats(action: string): string {
  switch (action) {
    case 'allemande': return '8';
    case 'do_si_do':  return '8';
    case 'swing':     return '8';
    case 'circle':    return '8';
    case 'pull_by':   return '2';
    case 'step':      return '2';
    case 'balance':   return '4';
    case 'box_the_gnat': return '4';
    case 'give_and_take_into_swing': return '16';
    case 'mad_robin':  return '8';
    default:          return '0';
  }
}

export function parseDirection(text: string): RelativeDirection | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  const asDir = RelativeDirectionSchema.safeParse({ kind: 'direction', value: trimmed });
  if (asDir.success) return asDir.data;
  const asRel = RelativeDirectionSchema.safeParse({ kind: 'relationship', value: trimmed });
  if (asRel.success) return asRel.data;
  return null;
}

export function directionToText(dir: RelativeDirection): string {
  return dir.value;
}

// --- Option constants ---

export const DIR_OPTIONS = ['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left', 'partner', 'neighbor', 'opposite'];

export const RELATIONSHIP_OPTIONS: Relationship[] = ['partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front'];
export const RELATIONSHIP_LABELS: Record<string, string> = {
  partner: 'partner', neighbor: 'neighbor', opposite: 'opposite',
  on_right: 'on your right', on_left: 'on your left', in_front: 'in front of you',
};

export const DROP_TARGET_OPTIONS: DropHandsTarget[] = ['partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front', 'right', 'left', 'both'];
export const DROP_TARGET_LABELS: Record<string, string> = {
  partner: 'partner hands', neighbor: 'neighbor hands', opposite: 'opposite hands',
  on_right: 'on-your-right hands', on_left: 'on-your-left hands', in_front: 'in-front hands',
  right: 'right hand', left: 'left hand', both: 'both hands',
};

export const HAND_OPTIONS = ['right', 'left'];
export const TAKE_HAND_OPTIONS = ['right', 'left', 'both', 'inside'];
export const CIRCLE_DIR_OPTIONS = ['left', 'right'];

export const ROLE_OPTIONS: Role[] = ['lark', 'robin'];

export const SPLIT_BY_OPTIONS = ['role', 'position'];
export const SPLIT_BY_LABELS: Record<string, string> = {
  role: 'role (larks / robins)', position: 'position (ups / downs)',
};
