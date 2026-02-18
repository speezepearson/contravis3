import { useState, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SearchableDropdown from './SearchableDropdown';
import type { SearchableDropdownHandle } from './SearchableDropdown';
import { InstructionSchema, DanceSchema, RelativeDirectionSchema, RelationshipSchema, SplitBySchema, DropHandsTargetSchema, HandSchema, ActionTypeSchema, AtomicInstructionSchema, InitFormationSchema } from './types';
import type { Instruction, AtomicInstruction, Relationship, RelativeDirection, SplitBy, DropHandsTarget, ActionType, InitFormation } from './types';
import { z } from 'zod';

const DIR_OPTIONS = ['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left', 'partner', 'neighbor', 'opposite'];

const ACTION_OPTIONS: (ActionType | 'split' | 'group')[] = ['take_hands', 'drop_hands', 'allemande', 'do_si_do', 'swing', 'circle', 'pull_by', 'turn', 'step', 'balance', 'split', 'group'];
const ACTION_LABELS: Record<string, string> = {
  take_hands: 'take hands', drop_hands: 'drop hands', allemande: 'allemande',
  do_si_do: 'do-si-do', swing: 'swing', circle: 'circle', pull_by: 'pull by',
  turn: 'turn', step: 'step', balance: 'balance', split: 'split', group: 'group',
};

const SPLIT_BY_OPTIONS = ['role', 'position'];
const SPLIT_BY_LABELS: Record<string, string> = {
  role: 'role (larks / robins)', position: 'position (ups / downs)',
};

const RELATIONSHIP_OPTIONS: Relationship[] = ['partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front'];
const RELATIONSHIP_LABELS: Record<string, string> = {
  partner: 'partner', neighbor: 'neighbor', opposite: 'opposite',
  on_right: 'on your right', on_left: 'on your left', in_front: 'in front of you',
};

const DROP_TARGET_OPTIONS: DropHandsTarget[] = ['partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front', 'right', 'left', 'both'];
const DROP_TARGET_LABELS: Record<string, string> = {
  partner: 'partner hands', neighbor: 'neighbor hands', opposite: 'opposite hands',
  on_right: 'on-your-right hands', on_left: 'on-your-left hands', in_front: 'in-front hands',
  right: 'right hand', left: 'left hand', both: 'both hands',
};

const HAND_OPTIONS = ['right', 'left'];
const CIRCLE_DIR_OPTIONS = ['left', 'right'];

function parseDirection(text: string): RelativeDirection | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  const asDir = RelativeDirectionSchema.safeParse({ kind: 'direction', value: trimmed });
  if (asDir.success) return asDir.data;
  const asRel = RelativeDirectionSchema.safeParse({ kind: 'relationship', value: trimmed });
  if (asRel.success) return asRel.data;
  return null;
}

function directionToText(dir: RelativeDirection): string {
  if (dir.kind === 'direction') return dir.value;
  return dir.value;
}

function splitGroupLabel(by: SplitBy, list: 'A' | 'B'): string {
  if (by === 'role') return list === 'A' ? 'Larks' : 'Robins';
  return list === 'A' ? 'Ups' : 'Downs';
}

function sumBeats(instructions: AtomicInstruction[]): number {
  return instructions.reduce((sum, i) => sum + i.beats, 0);
}

function defaultBeats(action: string): string {
  switch (action) {
    case 'allemande': return '8';
    case 'do_si_do':  return '8';
    case 'swing':     return '8';
    case 'circle':    return '8';
    case 'pull_by':   return '2';
    case 'step':      return '2';
    case 'balance':   return '4';
    default:          return '0';
  }
}

let nextId = 1;

// --- Tree manipulation helpers for cross-container drag ---

function parseContainerId(id: string):
  | { type: 'top' }
  | { type: 'group'; groupId: number }
  | { type: 'split'; splitId: number; list: 'A' | 'B' }
{
  if (id === 'top') return { type: 'top' };
  const groupMatch = id.match(/^group-(\d+)$/);
  if (groupMatch) return { type: 'group', groupId: Number(groupMatch[1]) };
  const splitMatch = id.match(/^split-(\d+)-(A|B)$/);
  if (splitMatch) return { type: 'split', splitId: Number(splitMatch[1]), list: z.enum(['A', 'B']).parse(splitMatch[2]) };
  return { type: 'top' };
}

function findInstructionById(instrs: Instruction[], id: number): Instruction | null {
  for (const i of instrs) {
    if (i.id === id) return i;
    if (i.type === 'group') {
      const found = findInstructionById(i.instructions, id);
      if (found) return found;
    }
    if (i.type === 'split') {
      for (const s of [...i.listA, ...i.listB]) {
        if (s.id === id) return InstructionSchema.parse(s);
      }
    }
  }
  return null;
}

function instructionContainsId(instr: Instruction, id: number): boolean {
  if (instr.id === id) return true;
  if (instr.type === 'group') return instr.instructions.some(c => instructionContainsId(c, id));
  if (instr.type === 'split') return [...instr.listA, ...instr.listB].some(c => c.id === id);
  return false;
}

function removeFromTree(instrs: Instruction[], targetId: number): [Instruction[], Instruction | null] {
  const topIdx = instrs.findIndex(i => i.id === targetId);
  if (topIdx !== -1) {
    return [[...instrs.slice(0, topIdx), ...instrs.slice(topIdx + 1)], instrs[topIdx]];
  }
  let removed: Instruction | null = null;
  const mapped = instrs.map(i => {
    if (removed) return i;
    if (i.type === 'split') {
      const aIdx = i.listA.findIndex(s => s.id === targetId);
      if (aIdx !== -1) { removed = InstructionSchema.parse(i.listA[aIdx]); return InstructionSchema.parse({ ...i, listA: [...i.listA.slice(0, aIdx), ...i.listA.slice(aIdx + 1)] }); }
      const bIdx = i.listB.findIndex(s => s.id === targetId);
      if (bIdx !== -1) { removed = InstructionSchema.parse(i.listB[bIdx]); return InstructionSchema.parse({ ...i, listB: [...i.listB.slice(0, bIdx), ...i.listB.slice(bIdx + 1)] }); }
    }
    if (i.type === 'group') {
      const [newChildren, r] = removeFromTree(i.instructions, targetId);
      if (r) { removed = r; return InstructionSchema.parse({ ...i, instructions: newChildren }); }
    }
    return i;
  });
  return [mapped, removed];
}

function insertIntoContainer(instrs: Instruction[], containerId: string, item: Instruction, index: number): Instruction[] {
  const parsed = parseContainerId(containerId);
  if (parsed.type === 'top') {
    const copy = [...instrs];
    copy.splice(index, 0, item);
    return copy;
  }
  return instrs.map(i => {
    if (parsed.type === 'group' && i.type === 'group' && i.id === parsed.groupId) {
      const copy = [...i.instructions];
      copy.splice(index, 0, item);
      return { ...i, instructions: copy };
    }
    if (parsed.type === 'split' && i.type === 'split' && i.id === parsed.splitId) {
      const key = parsed.list === 'A' ? 'listA' : 'listB';
      const copy = [...i[key]];
      copy.splice(index, 0, AtomicInstructionSchema.parse(item));
      return { ...i, [key]: copy };
    }
    if (i.type === 'group') {
      return { ...i, instructions: insertIntoContainer(i.instructions, containerId, item, index) };
    }
    return i;
  });
}

function reorderInContainer(instrs: Instruction[], containerId: string, oldIndex: number, newIndex: number): Instruction[] {
  const parsed = parseContainerId(containerId);
  if (parsed.type === 'top') return arrayMove(instrs, oldIndex, newIndex);
  return instrs.map(i => {
    if (parsed.type === 'group' && i.type === 'group' && i.id === parsed.groupId) {
      return { ...i, instructions: arrayMove(i.instructions, oldIndex, newIndex) };
    }
    if (parsed.type === 'split' && i.type === 'split' && i.id === parsed.splitId) {
      const key = parsed.list === 'A' ? 'listA' : 'listB';
      return { ...i, [key]: arrayMove(i[key], oldIndex, newIndex) };
    }
    if (i.type === 'group') {
      return { ...i, instructions: reorderInContainer(i.instructions, containerId, oldIndex, newIndex) };
    }
    return i;
  });
}

function getContainerItems(instrs: Instruction[], containerId: string): Instruction[] | null {
  const parsed = parseContainerId(containerId);
  if (parsed.type === 'top') return instrs;
  for (const i of instrs) {
    if (parsed.type === 'group' && i.type === 'group' && i.id === parsed.groupId) return i.instructions;
    if (parsed.type === 'split' && i.type === 'split' && i.id === parsed.splitId) {
      return z.array(InstructionSchema).parse(parsed.list === 'A' ? i.listA : i.listB);
    }
    if (i.type === 'group') {
      const found = getContainerItems(i.instructions, containerId);
      if (found !== null) return found;
    }
  }
  return null;
}

interface Props {
  instructions: Instruction[];
  setInstructions: (instructions: Instruction[]) => void;
  initFormation: InitFormation;
  setInitFormation: (formation: InitFormation) => void;
  activeId: number | null;
  warnings: Map<number, string>;
}

type BuilderContext =
  | { level: 'top' }
  | { level: 'sub'; splitId: number; list: 'A' | 'B' }
  | { level: 'group'; groupId: number };

function summarizeAtomic(instr: AtomicInstruction): string {
  switch (instr.type) {
    case 'take_hands': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : `${r}s`;
      return `${label} take ${instr.hand} hands`;
    }
    case 'drop_hands': {
      const t = instr.target;
      if (t === 'both') return 'drop all hands';
      if (t === 'left' || t === 'right') return `drop ${t} hand`;
      const label = t === 'on_right' ? 'on-your-right' : t === 'on_left' ? 'on-your-left' : t === 'in_front' ? 'in-front' : t;
      return `drop ${label} hands`;
    }
    case 'allemande': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : r;
      return `${label} allemande ${instr.handedness} ${instr.rotations}x (${instr.beats}b)`;
    }
    case 'do_si_do': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : r;
      return `${label} do-si-do ${instr.rotations}x (${instr.beats}b)`;
    }
    case 'circle':
      return `circle ${instr.direction} ${instr.rotations}x (${instr.beats}b)`;
    case 'pull_by': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : r;
      return `${label} pull by ${instr.hand} (${instr.beats}b)`;
    }
    case 'turn': {
      const t = instr.target;
      const desc = t.kind === 'direction' ? t.value : t.value;
      const offsetStr = instr.offset ? ` +${instr.offset}\u00B0` : '';
      return `turn ${desc}${offsetStr} (${instr.beats}b)`;
    }
    case 'step': {
      const t = instr.direction;
      const desc = t.kind === 'direction' ? t.value : t.value;
      return `step ${desc} ${instr.distance} (${instr.beats}b)`;
    }
    case 'balance': {
      const t = instr.direction;
      const desc = t.kind === 'direction' ? t.value : t.value;
      return `balance ${desc} ${instr.distance} (${instr.beats}b)`;
    }
    case 'swing': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : r;
      const ef = instr.endFacing.kind === 'direction' ? instr.endFacing.value : instr.endFacing.value;
      return `${label} swing \u2192 ${ef} (${instr.beats}b)`;
    }
  }
}

function instrDuration(instr: Instruction): number {
  if (instr.type === 'split')
    return Math.max(sumBeats(instr.listA), sumBeats(instr.listB));
  if (instr.type === 'group')
    return instr.instructions.reduce((s, i) => s + instrDuration(i), 0);
  return instr.beats;
}

function summarize(instr: Instruction): string {
  if (instr.type === 'split') {
    const totalBeats = Math.max(sumBeats(instr.listA), sumBeats(instr.listB));
    return `split by ${instr.by} (${totalBeats}b)`;
  }
  if (instr.type === 'group') {
    const totalBeats = instrDuration(instr);
    return `${instr.label} (${totalBeats}b)`;
  }
  return summarizeAtomic(instr);
}

function SortableItem({ id, children }: { id: number; children: (dragHandleProps: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

function DropZone({ containerId }: { containerId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  return <div ref={setNodeRef} className={`drop-zone${isOver ? ' drop-zone-active' : ''}`} />;
}

export default function CommandPane({ instructions, setInstructions, initFormation, setInitFormation, activeId, warnings }: Props) {
  const [context, setContext] = useState<BuilderContext>({ level: 'top' });
  const [action, setAction] = useState<ActionType | 'split' | 'group'>('take_hands');
  const [relationship, setRelationship] = useState<Relationship>('neighbor');
  const [dropTarget, setDropTarget] = useState<DropHandsTarget>('neighbor');
  const [hand, setHand] = useState<'left' | 'right'>('right');
  const [handedness, setHandedness] = useState<'left' | 'right'>('right');
  const [rotations, setRotations] = useState('1');
  const [turnText, setTurnText] = useState('');
  const [turnOffset, setTurnOffset] = useState('0');
  const [stepText, setStepText] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [distance, setDistance] = useState('0.5');
  const [beats, setBeats] = useState('0');
  const [splitBy, setSplitBy] = useState<SplitBy>('role');
  const [groupLabel, setGroupLabel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const actionRef = useRef<SearchableDropdownHandle>(null);

  function loadAtomicIntoForm(instr: AtomicInstruction) {
    setAction(instr.type);
    setBeats(String(instr.beats));
    if (instr.type === 'take_hands') {
      setRelationship(instr.relationship);
      setHand(instr.hand);
    } else if (instr.type === 'drop_hands') {
      setDropTarget(instr.target);
    } else if (instr.type === 'allemande') {
      setRelationship(instr.relationship);
      setHandedness(instr.handedness);
      setRotations(String(instr.rotations));
    } else if (instr.type === 'do_si_do') {
      setRelationship(instr.relationship);
      setRotations(String(instr.rotations));
    } else if (instr.type === 'circle') {
      setHandedness(instr.direction);
      setRotations(String(instr.rotations));
    } else if (instr.type === 'pull_by') {
      setRelationship(instr.relationship);
      setHand(instr.hand);
    } else if (instr.type === 'turn') {
      setTurnText(directionToText(instr.target));
      setTurnOffset(String(instr.offset));
    } else if (instr.type === 'step') {
      setStepText(directionToText(instr.direction));
      setDistance(String(instr.distance));
    } else if (instr.type === 'balance') {
      setBalanceText(directionToText(instr.direction));
      setDistance(String(instr.distance));
    } else if (instr.type === 'swing') {
      setRelationship(instr.relationship);
      setTurnText(directionToText(instr.endFacing));
    }
  }

  function loadIntoForm(instr: Instruction) {
    if (instr.type === 'split') {
      setAction('split');
      setSplitBy(instr.by);
    } else if (instr.type === 'group') {
      setAction('group');
      setGroupLabel(instr.label);
    } else {
      loadAtomicIntoForm(instr);
    }
  }

  function buildAtomicInstruction(id: number): AtomicInstruction {
    const base = { id, beats: Number(beats) || 0 };
    switch (ActionTypeSchema.parse(action)) {
      case 'take_hands':
        return { id, beats: 0, type: 'take_hands', relationship, hand };
      case 'drop_hands':
        return { id, beats: 0, type: 'drop_hands', target: dropTarget };
      case 'allemande':
        return { ...base, type: 'allemande', relationship, handedness, rotations: Number(rotations) || 1 };
      case 'do_si_do':
        return { ...base, type: 'do_si_do', relationship, rotations: Number(rotations) || 1 };
      case 'circle':
        return { ...base, type: 'circle', direction: handedness, rotations: Number(rotations) || 1 };
      case 'pull_by':
        return { ...base, type: 'pull_by', relationship, hand };
      case 'turn': {
        const target = parseDirection(turnText) ?? { kind: 'direction' as const, value: 'up' as const };
        return { ...base, type: 'turn', target, offset: Number(turnOffset) || 0 };
      }
      case 'step': {
        const dir = parseDirection(stepText) ?? { kind: 'direction' as const, value: 'up' as const };
        return { ...base, type: 'step', direction: dir, distance: Number(distance) || 0 };
      }
      case 'balance': {
        const dir = parseDirection(balanceText) ?? { kind: 'direction' as const, value: 'across' as const };
        return { ...base, type: 'balance', direction: dir, distance: Number(distance) || 0 };
      }
      case 'swing': {
        const endFacing = parseDirection(turnText) ?? { kind: 'direction' as const, value: 'across' as const };
        return { ...base, type: 'swing', relationship, endFacing };
      }
    }
  }

  function buildInstruction(id: number): Instruction {
    let raw;
    if (action === 'group') {
      raw = { id, type: 'group', label: groupLabel || 'Untitled', instructions: [] };
    } else if (action === 'split') {
      raw = { id, type: 'split', by: splitBy, listA: [], listB: [] };
    } else {
      raw = buildAtomicInstruction(id);
    }
    return InstructionSchema.parse(raw);
  }

  /** Recursively update a group's instructions by its id. */
  function updateGroup(instrs: Instruction[], groupId: number, updater: (children: Instruction[]) => Instruction[]): Instruction[] {
    return instrs.map(i => {
      if (i.type === 'group' && i.id === groupId) {
        return { ...i, instructions: updater(i.instructions) };
      }
      if (i.type === 'group') {
        return { ...i, instructions: updateGroup(i.instructions, groupId, updater) };
      }
      return i;
    });
  }

  function resetForm() {
    setAction('take_hands');
    setBeats(defaultBeats('take_hands'));
    actionRef.current?.focus();
  }

  function add() {
    if (context.level === 'sub') {
      // Adding to a split's sub-list
      const { splitId, list } = context;
      if (action === 'split') return; // no nesting
      const newInstr = buildAtomicInstruction(nextId++);
      if (editingId !== null) {
        setInstructions(instructions.map(i => {
          if (i.type !== 'split' || i.id !== splitId) return i;
          const key = list === 'A' ? 'listA' : 'listB';
          return { ...i, [key]: i[key].map(sub => sub.id === editingId ? newInstr : sub) };
        }));
        setEditingId(null);
      } else {
        setInstructions(instructions.map(i => {
          if (i.type !== 'split' || i.id !== splitId) return i;
          const key = list === 'A' ? 'listA' : 'listB';
          return { ...i, [key]: [...i[key], newInstr] };
        }));
        resetForm();
      }
    } else if (context.level === 'group') {
      // Adding to a group's children
      const { groupId } = context;
      const newInstr = buildInstruction(nextId++);
      if (editingId !== null) {
        setInstructions(updateGroup(instructions, groupId, children =>
          children.map(i => i.id === editingId ? newInstr : i)
        ));
        setEditingId(null);
      } else {
        setInstructions(updateGroup(instructions, groupId, children =>
          [...children, newInstr]
        ));
        resetForm();
      }
    } else {
      // Top-level
      if (editingId !== null) {
        setInstructions(instructions.map(i => i.id === editingId ? buildInstruction(editingId) : i));
        setEditingId(null);
      } else {
        setInstructions([...instructions, buildInstruction(nextId++)]);
        resetForm();
      }
    }
  }

  function startEdit(instr: Instruction) {
    loadIntoForm(instr);
    setEditingId(instr.id);
    setContext({ level: 'top' });
  }

  function startSubEdit(splitId: number, list: 'A' | 'B', instr: AtomicInstruction) {
    loadAtomicIntoForm(instr);
    setEditingId(instr.id);
    setContext({ level: 'sub', splitId, list });
  }

  function cancelEdit() {
    setEditingId(null);
    setContext({ level: 'top' });
  }

  function remove(id: number) {
    setInstructions(instructions.filter(i => i.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setContext({ level: 'top' });
    }
  }

  function removeSub(splitId: number, list: 'A' | 'B', subId: number) {
    setInstructions(instructions.map(i => {
      if (i.type !== 'split' || i.id !== splitId) return i;
      const key = list === 'A' ? 'listA' : 'listB';
      return { ...i, [key]: i[key].filter(sub => sub.id !== subId) };
    }));
    if (editingId === subId) {
      setEditingId(null);
      setContext({ level: 'top' });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const srcContainer = z.string().catch('top').parse(active.data.current?.sortable?.containerId);
    const overSortableContainer = z.string().optional().parse(over.data.current?.sortable?.containerId);
    const destContainer = overSortableContainer ?? String(over.id);

    // Dropping on itself
    if (active.id === over.id) return;

    // Same-container reorder (only when over is a sortable item, not a drop zone)
    if (srcContainer === destContainer && overSortableContainer) {
      const items = getContainerItems(instructions, srcContainer);
      if (!items) return;
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setInstructions(reorderInContainer(instructions, srcContainer, oldIndex, newIndex));
      }
      return;
    }

    // Cross-container move (or drop on a DropZone)
    const activeId = z.number().parse(active.id);
    const draggedInstr = findInstructionById(instructions, activeId);
    if (!draggedInstr) return;

    const destParsed = parseContainerId(destContainer);

    // Splits only accept atomic instructions
    if (destParsed.type === 'split' && (draggedInstr.type === 'group' || draggedInstr.type === 'split')) return;

    // Prevent cycles: can't drop a container into itself or its descendants
    if (destParsed.type === 'group' && instructionContainsId(draggedInstr, destParsed.groupId)) return;
    if (destParsed.type === 'split' && instructionContainsId(draggedInstr, destParsed.splitId)) return;

    const [treeWithout, removed] = removeFromTree(instructions, activeId);
    if (!removed) return;

    let insertIdx: number;
    if (overSortableContainer) {
      // Dropped on a specific item in the destination container
      const destItems = getContainerItems(treeWithout, destContainer);
      const overIdx = destItems ? destItems.findIndex(i => i.id === over.id) : -1;
      insertIdx = overIdx !== -1 ? overIdx : (destItems?.length ?? 0);
    } else {
      // Dropped on a DropZone — append at end
      insertIdx = getContainerItems(treeWithout, destContainer)?.length ?? 0;
    }

    setInstructions(insertIntoContainer(treeWithout, destContainer, removed, insertIdx));
    // Cancel any active edit since the item moved
    if (editingId === activeId) {
      setEditingId(null);
      setContext({ level: 'top' });
    }
  }

  function enterSubContext(splitId: number, list: 'A' | 'B') {
    setContext({ level: 'sub', splitId, list });
    setEditingId(null);
    setAction('take_hands');
  }

  function enterGroupContext(groupId: number) {
    setContext({ level: 'group', groupId });
    setEditingId(null);
    setAction('take_hands');
  }

  function startGroupChildEdit(groupId: number, instr: Instruction) {
    loadIntoForm(instr);
    setEditingId(instr.id);
    setContext({ level: 'group', groupId });
  }

  function removeGroupChild(groupId: number, childId: number) {
    setInstructions(updateGroup(instructions, groupId, children =>
      children.filter(i => i.id !== childId)
    ));
    if (editingId === childId) {
      setEditingId(null);
      setContext({ level: 'top' });
    }
  }

  function copyJson() {
    const dance = { initFormation, instructions };
    navigator.clipboard.writeText(JSON.stringify(dance, null, 2));
    setCopyFeedback('Copied!');
    setTimeout(() => setCopyFeedback(''), 1500);
  }

  function tryLoadJson(text: string) {
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return; }
    const result = DanceSchema.safeParse(raw);
    if (!result.success) return;
    const parsed = result.data;
    setInitFormation(parsed.initFormation);
    setInstructions(parsed.instructions);
    // Advance nextId past all loaded IDs
    function maxId(instrs: Instruction[]): number {
      let m = 0;
      for (const i of instrs) {
        m = Math.max(m, i.id);
        if (i.type === 'split') {
          for (const sub of [...i.listA, ...i.listB]) m = Math.max(m, sub.id);
        } else if (i.type === 'group') {
          m = Math.max(m, maxId(i.instructions));
        }
      }
      return m;
    }
    nextId = maxId(parsed.instructions) + 1;
    setEditingId(null);
    setContext({ level: 'top' });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const isSubContext = context.level === 'sub';
  const isGroupContext = context.level === 'group';
  const currentSplitRaw = isSubContext
    ? instructions.find(i => i.type === 'split' && i.id === context.splitId)
    : undefined;
  const currentSplit = currentSplitRaw?.type === 'split' ? currentSplitRaw : undefined;

  function findGroup(instrs: Instruction[], id: number): Extract<Instruction, { type: 'group' }> | undefined {
    for (const i of instrs) {
      if (i.type === 'group' && i.id === id) return i;
      if (i.type === 'group') {
        const found = findGroup(i.instructions, id);
        if (found) return found;
      }
    }
    return undefined;
  }
  const currentGroup = isGroupContext ? findGroup(instructions, context.groupId) : undefined;

  return (
    <div className="command-pane">
      <h2>Instructions</h2>

      <div className="formation-selector">
        <label>Formation: </label>
        <SearchableDropdown
          options={InitFormationSchema.options}
          value={initFormation}
          onChange={v => setInitFormation(InitFormationSchema.parse(v))}
          getLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
        />
      </div>

      {isSubContext && currentSplit && (
        <div className="builder-context">
          Adding to {splitGroupLabel(currentSplit.by, context.list)}
          <button className="back-btn" onClick={() => { setContext({ level: 'top' }); setEditingId(null); }}>Back</button>
        </div>
      )}
      {isGroupContext && currentGroup && (
        <div className="builder-context">
          Adding to {currentGroup.label}
          <button className="back-btn" onClick={() => { setContext({ level: 'top' }); setEditingId(null); }}>Back</button>
        </div>
      )}

      <div className="instruction-builder">
        <label>
          Action
          <SearchableDropdown
            ref={actionRef}
            options={isSubContext ? ACTION_OPTIONS.filter(o => o !== 'split' && o !== 'group') : ACTION_OPTIONS}
            value={action}
            onChange={v => {
              const a = z.union([ActionTypeSchema, z.literal('split'), z.literal('group')]).parse(v);
              setAction(a);
              if (editingId === null) {
                setBeats(defaultBeats(a));
                if (a === 'swing') setTurnText('across');
              }
            }}
            getLabel={v => ACTION_LABELS[v] ?? v}
          />
        </label>

        {action === 'split' && (
          <label>
            Split by
            <SearchableDropdown
              options={SPLIT_BY_OPTIONS}
              value={splitBy}
              onChange={v => setSplitBy(SplitBySchema.parse(v))}
              getLabel={v => SPLIT_BY_LABELS[v] ?? v}
            />
          </label>
        )}

        {action === 'group' && (
          <label>
            Label
            <input
              type="text"
              value={groupLabel}
              onChange={e => setGroupLabel(e.target.value)}
              placeholder="e.g. Allemande figure"
            />
          </label>
        )}

        {action !== 'split' && action !== 'group' && (action === 'take_hands' || action === 'allemande' || action === 'do_si_do' || action === 'pull_by' || action === 'swing') && (
          <label>
            With
            <SearchableDropdown
              options={RELATIONSHIP_OPTIONS}
              value={relationship}
              onChange={v => setRelationship(RelationshipSchema.parse(v))}
              getLabel={v => RELATIONSHIP_LABELS[v] ?? v}
            />
          </label>
        )}

        {action === 'drop_hands' && (
          <label>
            Drop
            <SearchableDropdown
              options={DROP_TARGET_OPTIONS}
              value={dropTarget}
              onChange={v => setDropTarget(DropHandsTargetSchema.parse(v))}
              getLabel={v => DROP_TARGET_LABELS[v] ?? v}
            />
          </label>
        )}

        {(action === 'take_hands' || action === 'pull_by') && (
          <label>
            Hand
            <SearchableDropdown
              options={HAND_OPTIONS}
              value={hand}
              onChange={v => setHand(HandSchema.parse(v))}
            />
          </label>
        )}

        {action === 'allemande' && (
          <>
            <label>
              Hand
              <SearchableDropdown
                options={HAND_OPTIONS}
                value={handedness}
                onChange={v => setHandedness(HandSchema.parse(v))}
              />
            </label>
            <label>
              Rotations
              <input
                type="text"
                inputMode="decimal"
                value={rotations}
                onChange={e => setRotations(e.target.value)}
              />
            </label>
          </>
        )}

        {action === 'do_si_do' && (
          <label>
            Rotations
            <input
              type="text"
              inputMode="decimal"
              value={rotations}
              onChange={e => setRotations(e.target.value)}
            />
          </label>
        )}

        {action === 'circle' && (
          <>
            <label>
              Direction
              <SearchableDropdown
                options={CIRCLE_DIR_OPTIONS}
                value={handedness}
                onChange={v => setHandedness(HandSchema.parse(v))}
              />
            </label>
            <label>
              Rotations
              <input
                type="text"
                inputMode="decimal"
                value={rotations}
                onChange={e => setRotations(e.target.value)}
              />
            </label>
          </>
        )}

        {action === 'turn' && (
          <>
            <label>
              Target
              <SearchableDropdown
                options={DIR_OPTIONS}
                value={turnText}
                onChange={setTurnText}
                placeholder="e.g. across, partner"
              />
            </label>
            <label>
              Offset
              <input
                type="text"
                inputMode="decimal"
                value={turnOffset}
                onChange={e => setTurnOffset(e.target.value)}
              />
            </label>
          </>
        )}

        {action === 'step' && (
          <>
            <label>
              Direction
              <SearchableDropdown
                options={DIR_OPTIONS}
                value={stepText}
                onChange={setStepText}
                placeholder="e.g. across, partner, 45"
              />
            </label>
            <label>
              Distance
              <input
                type="text"
                inputMode="decimal"
                value={distance}
                onChange={e => setDistance(e.target.value)}
              />
            </label>
          </>
        )}

        {action === 'balance' && (
          <>
            <label>
              Direction
              <SearchableDropdown
                options={DIR_OPTIONS}
                value={balanceText}
                onChange={setBalanceText}
                placeholder="e.g. across, partner, 45"
              />
            </label>
            <label>
              Distance
              <input
                type="text"
                inputMode="decimal"
                value={distance}
                onChange={e => setDistance(e.target.value)}
              />
            </label>
          </>
        )}

        {action === 'swing' && (
          <label>
            End facing
            <SearchableDropdown
              options={DIR_OPTIONS}
              value={turnText}
              onChange={setTurnText}
              placeholder="e.g. across, up"
            />
          </label>
        )}

        {action !== 'split' && action !== 'take_hands' && action !== 'drop_hands' && (
          <label>
            Beats
            <input
              type="text"
              inputMode="decimal"
              value={beats}
              onChange={e => setBeats(e.target.value)}
            />
          </label>
        )}

        <div className="builder-buttons">
          <button className="add-btn" onClick={add}>{editingId !== null ? 'Save' : 'Add'}</button>
          {editingId !== null && <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="instruction-list">
          <SortableContext id="top" items={instructions.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {instructions.map(instr => (
              <SortableItem key={instr.id} id={instr.id}>
                {(dragHandleProps) => (
                  <>
                    <div className={`instruction-item${editingId === instr.id && context.level === 'top' ? ' editing' : ''}${instr.id === activeId ? ' active' : ''}`}>
                      <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                      <span className="instruction-summary">{summarize(instr)}</span>
                      <div className="instruction-actions">
                        <button onClick={() => startEdit(instr)} title="Edit">{'\u270E'}</button>
                        <button onClick={() => remove(instr.id)} title="Delete">{'\u00D7'}</button>
                      </div>
                    </div>
                    {warnings.get(instr.id) && (
                      <div className="instruction-warning">{warnings.get(instr.id)}</div>
                    )}
                    {instr.type === 'split' && renderSplitBody(instr)}
                    {instr.type === 'group' && renderGroupBody(instr)}
                  </>
                )}
              </SortableItem>
            ))}
          </SortableContext>
          <DropZone containerId="top" />
        {instructions.length === 0 && (
          <div className="instruction-empty">No instructions yet. Add one above.</div>
        )}
      </div>

      <div className="json-io">
        <button onClick={copyJson}>{copyFeedback || 'Copy JSON'}</button>
        <textarea
          value=""
          onChange={() => {}}
          onPaste={e => {
            e.preventDefault();
            const text = e.clipboardData.getData('text');
            tryLoadJson(text);
          }}
          placeholder="Paste JSON here to load"
          rows={3}
        />
      </div>
      </DndContext>
    </div>
  );

  function renderGroupBody(group: Extract<Instruction, { type: 'group' }>) {
    const containerId = `group-${group.id}`;
    return (
      <div className="group-body">
        <SortableContext id={containerId} items={group.instructions.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {group.instructions.map(child => (
            <SortableItem key={child.id} id={child.id}>
              {(dragHandleProps) => (
                <>
                  <div className={`instruction-item group-child-item${editingId === child.id ? ' editing' : ''}${child.id === activeId ? ' active' : ''}`}>
                    <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                    <span className="instruction-summary">{summarize(child)}</span>
                    <div className="instruction-actions">
                      <button onClick={() => startGroupChildEdit(group.id, child)} title="Edit">{'\u270E'}</button>
                      <button onClick={() => removeGroupChild(group.id, child.id)} title="Delete">{'\u00D7'}</button>
                    </div>
                  </div>
                  {warnings.get(child.id) && (
                    <div className="instruction-warning">{warnings.get(child.id)}</div>
                  )}
                  {child.type === 'split' && renderSplitBody(child)}
                  {child.type === 'group' && renderGroupBody(child)}
                </>
              )}
            </SortableItem>
          ))}
        </SortableContext>
        <DropZone containerId={containerId} />
        <button
          className="split-add-btn"
          onClick={() => enterGroupContext(group.id)}
        >
          + Add to {group.label.toLowerCase()}
        </button>
      </div>
    );
  }

  function renderSplitBody(split: Extract<Instruction, { type: 'split' }>) {
    return (
      <div className="split-body">
        {(['A', 'B'] as const).map(list => {
          const subList = list === 'A' ? split.listA : split.listB;
          const label = splitGroupLabel(split.by, list);
          const containerId = `split-${split.id}-${list}`;
          return (
            <div key={list} className="split-group">
              <div className="split-group-header">{label}:</div>
              <SortableContext id={containerId} items={subList.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {subList.map(sub => (
                  <SortableItem key={sub.id} id={sub.id}>
                    {(dragHandleProps) => (
                      <div className={`instruction-item split-sub-item${editingId === sub.id ? ' editing' : ''}`}>
                        <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                        <span className="instruction-summary">{summarizeAtomic(sub)}</span>
                        <div className="instruction-actions">
                          <button onClick={() => startSubEdit(split.id, list, sub)} title="Edit">{'\u270E'}</button>
                          <button onClick={() => removeSub(split.id, list, sub.id)} title="Delete">{'\u00D7'}</button>
                        </div>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
              <DropZone containerId={containerId} />
              <button
                className="split-add-btn"
                onClick={() => enterSubContext(split.id, list)}
              >
                + Add to {label.toLowerCase()}
              </button>
            </div>
          );
        })}
      </div>
    );
  }
}
