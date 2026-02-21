import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SearchableDropdown from './SearchableDropdown';
import type { SearchableDropdownHandle } from './SearchableDropdown';
import { InstructionSchema, DanceSchema, AtomicInstructionSchema, InitFormationSchema, InstructionIdSchema, ActionTypeSchema, splitLists, splitWithLists, instructionDuration, formatDanceParseError } from './types';
import type { Instruction, AtomicInstruction, SplitBy, ActionType, InitFormation, InstructionId, Dance } from './types';
import type { GenerateError } from './generate';
import { findInstructionStartBeat, findInstructionScope, ALL_DANCERS, SPLIT_GROUPS } from './generate';
import type { ProtoDancerId } from './types';
import { z } from 'zod';
import { directionToText } from './fieldUtils';

import { TakeHandsFields } from './figures/TakeHandsFields';
import { DropHandsFields } from './figures/DropHandsFields';
import { AllemandeFields } from './figures/AllemandeFields';
import { DoSiDoFields } from './figures/DoSiDoFields';
import { CircleFields } from './figures/CircleFields';
import { PullByFields } from './figures/PullByFields';
import { TurnFields } from './figures/TurnFields';
import { StepFields } from './figures/StepFields';
import { BalanceFields } from './figures/BalanceFields';
import { SwingFields } from './figures/SwingFields';
import { BoxTheGnatFields } from './figures/BoxTheGnatFields';
import { GiveAndTakeIntoSwingFields } from './figures/GiveAndTakeIntoSwingFields';
import { MadRobinFields } from './figures/MadRobinFields';
import { SplitFields } from './figures/SplitFields';
import { GroupFields } from './figures/GroupFields';

const exampleDanceModules = import.meta.glob<Dance>('/example-dances/*.json', { eager: true, import: 'default' });
const exampleDances: { key: string; label: string; dance: Dance }[] = Object.entries(exampleDanceModules).map(([path, dance]) => {
  const filename = path.split('/').pop()!.replace(/\.json$/, '');
  const fallbackName = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const displayName = dance.name || fallbackName;
  const label = dance.author ? `${displayName} (${dance.author})` : displayName;
  return { key: filename, label, dance };
});

const ACTION_OPTIONS: (ActionType | 'split' | 'group')[] = ['take_hands', 'drop_hands', 'allemande', 'do_si_do', 'swing', 'circle', 'pull_by', 'turn', 'step', 'balance', 'box_the_gnat', 'give_and_take_into_swing', 'mad_robin', 'split', 'group'];
const ACTION_LABELS: Record<string, string> = {
  take_hands: 'take hands', drop_hands: 'drop hands', allemande: 'allemande',
  do_si_do: 'do-si-do', swing: 'swing', circle: 'circle', pull_by: 'pull by',
  turn: 'turn', step: 'step', balance: 'balance',
  box_the_gnat: 'box the gnat', give_and_take_into_swing: 'give & take into swing',
  mad_robin: 'mad robin',
  split: 'split', group: 'group',
};

function splitGroupLabel(by: SplitBy['by'], list: 'A' | 'B'): string {
  if (by === 'role') return list === 'A' ? 'Larks' : 'Robins';
  return list === 'A' ? 'Ups' : 'Downs';
}

function makeInstructionId(): InstructionId {
  return InstructionIdSchema.parse(crypto.randomUUID());
}

// --- Tree manipulation helpers for cross-container drag ---

function parseContainerId(id: string):
  | { type: 'top' }
  | { type: 'group'; groupId: InstructionId }
  | { type: 'split'; splitId: InstructionId; list: 'A' | 'B' }
{
  if (id === 'top') return { type: 'top' };
  if (id.startsWith('group-'))
    return { type: 'group', groupId: InstructionIdSchema.parse(id.slice(6)) };
  if (id.startsWith('split-') && (id.endsWith('-A') || id.endsWith('-B'))) {
    const list = z.enum(['A', 'B']).parse(id.slice(-1));
    return { type: 'split', splitId: InstructionIdSchema.parse(id.slice(6, -2)), list };
  }
  return { type: 'top' };
}

function findInstructionById(instrs: Instruction[], id: InstructionId): Instruction | null {
  for (const i of instrs) {
    if (i.id === id) return i;
    if (i.type === 'group') {
      const found = findInstructionById(i.instructions, id);
      if (found) return found;
    }
    if (i.type === 'split') {
      const [listA, listB] = splitLists(i);
      for (const s of [...listA, ...listB]) {
        if (s.id === id) return InstructionSchema.parse(s);
      }
    }
  }
  return null;
}

function instructionContainsId(instr: Instruction, id: InstructionId): boolean {
  if (instr.id === id) return true;
  if (instr.type === 'group') return instr.instructions.some(c => instructionContainsId(c, id));
  if (instr.type === 'split') { const [listA, listB] = splitLists(instr); return [...listA, ...listB].some(c => c.id === id); }
  return false;
}

function removeFromTree(instrs: Instruction[], targetId: InstructionId): [Instruction[], Instruction | null] {
  const topIdx = instrs.findIndex(i => i.id === targetId);
  if (topIdx !== -1) {
    return [[...instrs.slice(0, topIdx), ...instrs.slice(topIdx + 1)], instrs[topIdx]];
  }
  let removed: Instruction | null = null;
  const mapped = instrs.map(i => {
    if (removed) return i;
    if (i.type === 'split') {
      const [listA, listB] = splitLists(i);
      const aIdx = listA.findIndex(s => s.id === targetId);
      if (aIdx !== -1) { removed = InstructionSchema.parse(listA[aIdx]); return InstructionSchema.parse({ ...i, ...splitWithLists(i.by, [...listA.slice(0, aIdx), ...listA.slice(aIdx + 1)], listB) }); }
      const bIdx = listB.findIndex(s => s.id === targetId);
      if (bIdx !== -1) { removed = InstructionSchema.parse(listB[bIdx]); return InstructionSchema.parse({ ...i, ...splitWithLists(i.by, listA, [...listB.slice(0, bIdx), ...listB.slice(bIdx + 1)]) }); }
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
      const [listA, listB] = splitLists(i);
      const list = parsed.list === 'A' ? listA : listB;
      const copy = [...list];
      copy.splice(index, 0, AtomicInstructionSchema.parse(item));
      const newLists = parsed.list === 'A' ? splitWithLists(i.by, copy, listB) : splitWithLists(i.by, listA, copy);
      return { ...i, ...newLists };
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
      const [listA, listB] = splitLists(i);
      const newLists = parsed.list === 'A'
        ? splitWithLists(i.by, arrayMove(listA, oldIndex, newIndex), listB)
        : splitWithLists(i.by, listA, arrayMove(listB, oldIndex, newIndex));
      return { ...i, ...newLists };
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
      const [listA, listB] = splitLists(i);
      return z.array(InstructionSchema).parse(parsed.list === 'A' ? listA : listB);
    }
    if (i.type === 'group') {
      const found = getContainerItems(i.instructions, containerId);
      if (found !== null) return found;
    }
  }
  return null;
}

function replaceInTree(instrs: Instruction[], id: InstructionId, replacement: Instruction): Instruction[] {
  return instrs.map(i => {
    if (i.id === id) return replacement;
    if (i.type === 'split') {
      const [listA, listB] = splitLists(i);
      if (!listA.some(s => s.id === id) && !listB.some(s => s.id === id)) return i;
      return InstructionSchema.parse({
        ...i,
        ...splitWithLists(
          i.by,
          listA.map(sub => sub.id === id ? AtomicInstructionSchema.parse(replacement) : sub),
          listB.map(sub => sub.id === id ? AtomicInstructionSchema.parse(replacement) : sub),
        ),
      });
    }
    if (i.type === 'group') {
      if (!i.instructions.some(c => instructionContainsId(c, id))) return i;
      return InstructionSchema.parse({ ...i, instructions: replaceInTree(i.instructions, id, replacement) });
    }
    return i;
  });
}

/** Given the erroring instruction's ID, compute the set of instruction IDs that
 *  should be visually dimmed — i.e. instructions that come strictly after the
 *  erroring instruction in sequential order (within the same branch of a split,
 *  within the same group, or at the top level). */
function computeDimmedIds(instructions: Instruction[], errorId: InstructionId | undefined): Set<InstructionId> {
  const dimmed = new Set<InstructionId>();
  if (!errorId) return dimmed;

  function addAllIds(instr: Instruction) {
    dimmed.add(instr.id);
    if (instr.type === 'group') {
      for (const child of instr.instructions) addAllIds(child);
    }
    if (instr.type === 'split') {
      const [la, lb] = splitLists(instr);
      for (const sub of [...la, ...lb]) dimmed.add(sub.id);
    }
  }

  function walk(instrs: Instruction[]): boolean {
    let found = false;
    for (const instr of instrs) {
      if (found) { addAllIds(instr); continue; }
      if (instr.id === errorId) { found = true; continue; }
      if (instr.type === 'group') {
        if (walk(instr.instructions)) found = true;
      } else if (instr.type === 'split') {
        const [la, lb] = splitLists(instr);
        if (walkAtomic(la) || walkAtomic(lb)) found = true;
      }
    }
    return found;
  }

  function walkAtomic(instrs: AtomicInstruction[]): boolean {
    let found = false;
    for (const instr of instrs) {
      if (found) { dimmed.add(instr.id); continue; }
      if (instr.id === errorId) found = true;
    }
    return found;
  }

  walk(instructions);
  return dimmed;
}

export interface EditingInfo {
  startBeat: number;
  scope: Set<ProtoDancerId>;
}

interface Props {
  instructions: Instruction[];
  setInstructions: (instructions: Instruction[]) => void;
  initFormation: InitFormation;
  setInitFormation: (formation: InitFormation) => void;
  progression: number;
  setProgression: (progression: number) => void;
  activeId: InstructionId | null;
  warnings: Map<InstructionId, string>;
  generateError: GenerateError | null;
  progressionWarning: string | null;
  onEditingStart?: (info: EditingInfo) => void;
  onEditingEnd?: () => void;
  onPreviewInstruction?: (instr: Instruction | null) => void;
  onHoverInstruction?: (id: InstructionId | null) => void;
  beat?: number;
  onBeatChange?: (beat: number) => void;
}

function relLabel(r: string): string {
  if (r === 'on_right') return 'on-your-right';
  if (r === 'on_left') return 'on-your-left';
  if (r === 'in_front') return 'in-front';
  return r;
}

function summarizeAtomic(instr: AtomicInstruction): string {
  switch (instr.type) {
    case 'take_hands': {
      const label = relLabel(instr.relationship) + (/^(partner|neighbor|opposite)$/.test(instr.relationship) ? 's' : '');
      const handLabel = instr.hand === 'both' ? 'both' : instr.hand;
      return `${label} take ${handLabel} hands`;
    }
    case 'drop_hands': {
      const t = instr.target;
      if (t === 'both') return 'drop all hands';
      if (t === 'left' || t === 'right') return `drop ${t} hand`;
      return `drop ${relLabel(t)} hands`;
    }
    case 'allemande':
      return `${relLabel(instr.relationship)} allemande ${instr.handedness} ${instr.rotations}x (${instr.beats}b)`;
    case 'do_si_do':
      return `${relLabel(instr.relationship)} do-si-do ${instr.rotations}x (${instr.beats}b)`;
    case 'circle':
      return `circle ${instr.direction} ${instr.rotations}x (${instr.beats}b)`;
    case 'pull_by':
      return `${relLabel(instr.relationship)} pull by ${instr.hand} (${instr.beats}b)`;
    case 'turn': {
      const offsetStr = instr.offset ? ` +${(instr.offset / (2 * Math.PI)).toFixed(2)} rot` : '';
      return `turn ${directionToText(instr.target)}${offsetStr} (${instr.beats}b)`;
    }
    case 'step':
      return `step ${directionToText(instr.direction)} ${instr.distance} (${instr.beats}b)`;
    case 'balance':
      return `balance ${directionToText(instr.direction)} ${instr.distance} (${instr.beats}b)`;
    case 'swing':
      return `${relLabel(instr.relationship)} swing \u2192 ${directionToText(instr.endFacing)} (${instr.beats}b)`;
    case 'box_the_gnat':
      return `${relLabel(instr.relationship)} box the gnat (${instr.beats}b)`;
    case 'give_and_take_into_swing':
      return `${instr.role}s give & take ${relLabel(instr.relationship)} into swing \u2192 ${directionToText(instr.endFacing)} (${instr.beats}b)`;
    case "mad_robin": {
      const dirLabel =
        instr.dir === "larks_in_middle"
          ? "larks in middle"
          : "robins in middle";
      const withLabel =
        instr.with === "larks_left" ? "larks' left" : "robins' left";
      return `mad robin ${dirLabel}, ${withLabel} ${instr.rotations}x (${instr.beats}b)`;
    }
  }
}

function summarize(instr: Instruction): string {
  if (instr.type === 'split' || instr.type === 'group') {
    const totalBeats = instructionDuration(instr);
    const prefix = instr.type === 'split' ? `split by ${instr.by}` : instr.label;
    return `${prefix} (${totalBeats}b)`;
  }
  return summarizeAtomic(instr);
}

function SortableItem({ id, children }: { id: InstructionId; children: (dragHandleProps: Record<string, unknown>) => React.ReactNode }) {
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

// --- InlineForm: self-contained instruction editor ---

function InlineForm({ initial, onSave, onCancel, allowContainers = true, onPreview, startBeat, beat, onBeatChange }: {
  initial?: Instruction;
  onSave: (instr: Instruction) => void;
  onCancel: () => void;
  allowContainers?: boolean;
  onPreview?: (instr: Instruction | null) => void;
  startBeat?: number;
  beat?: number;
  onBeatChange?: (beat: number) => void;
}) {
  const [action, setAction] = useState<ActionType | 'split' | 'group'>(() => {
    if (!initial) return 'take_hands';
    if (initial.type === 'split') return 'split';
    if (initial.type === 'group') return 'group';
    return initial.type;
  });

  const actionRef = useRef<SearchableDropdownHandle>(null);
  useEffect(() => { if (!initial) actionRef.current?.focus(); }, []);
  const [id] = useState(() => initial ? initial.id : makeInstructionId());
  const isEditing = !!initial;

  // Track end beat for playback slider
  const sb = startBeat ?? 0;
  const [endBeat, setEndBeat] = useState(() => sb + (initial ? instructionDuration(initial) : 0));
  const wrappedOnPreview = useCallback((instr: Instruction | null) => {
    onPreview?.(instr);
    if (instr) setEndBeat(sb + instructionDuration(instr));
  }, [onPreview, sb]);
  const common = { id, isEditing, onSave, onCancel, onPreview: wrappedOnPreview };

  const actionOptions = allowContainers
    ? ACTION_OPTIONS
    : ACTION_OPTIONS.filter(o => o !== 'split' && o !== 'group');

  const showSlider = onBeatChange && endBeat > sb;
  const clampedBeat = Math.min(Math.max(beat ?? sb, sb), endBeat);

  return (
    <div className="inline-form">
      {showSlider && (
        <input
          type="range"
          className="inline-form-scrubber"
          min={Math.round(sb * 100)}
          max={Math.round(endBeat * 100)}
          value={Math.round(clampedBeat * 100)}
          onChange={e => onBeatChange!(Number(e.target.value) / 100)}
        />
      )}
      <label>
        Action
        <SearchableDropdown
          ref={actionRef}
          options={actionOptions}
          value={action}
          onChange={v => setAction(z.union([ActionTypeSchema, z.literal('split'), z.literal('group')]).parse(v))}
          getLabel={v => ACTION_LABELS[v] ?? v}
        />
      </label>
      {action === 'take_hands' && <TakeHandsFields {...common} initial={initial?.type === 'take_hands' ? initial : undefined} />}
      {action === 'drop_hands' && <DropHandsFields {...common} initial={initial?.type === 'drop_hands' ? initial : undefined} />}
      {action === 'allemande' && <AllemandeFields {...common} initial={initial?.type === 'allemande' ? initial : undefined} />}
      {action === 'do_si_do' && <DoSiDoFields {...common} initial={initial?.type === 'do_si_do' ? initial : undefined} />}
      {action === 'circle' && <CircleFields {...common} initial={initial?.type === 'circle' ? initial : undefined} />}
      {action === 'pull_by' && <PullByFields {...common} initial={initial?.type === 'pull_by' ? initial : undefined} />}
      {action === 'turn' && <TurnFields {...common} initial={initial?.type === 'turn' ? initial : undefined} />}
      {action === 'step' && <StepFields {...common} initial={initial?.type === 'step' ? initial : undefined} />}
      {action === 'balance' && <BalanceFields {...common} initial={initial?.type === 'balance' ? initial : undefined} />}
      {action === 'swing' && <SwingFields {...common} initial={initial?.type === 'swing' ? initial : undefined} />}
      {action === 'box_the_gnat' && <BoxTheGnatFields {...common} initial={initial?.type === 'box_the_gnat' ? initial : undefined} />}
      {action === 'give_and_take_into_swing' && <GiveAndTakeIntoSwingFields {...common} initial={initial?.type === 'give_and_take_into_swing' ? initial : undefined} />}
      {action === 'mad_robin' && <MadRobinFields {...common} initial={initial?.type === 'mad_robin' ? initial : undefined} />}
      {action === 'split' && <SplitFields {...common} initial={initial?.type === 'split' ? initial : undefined} />}
      {action === 'group' && <GroupFields {...common} initial={initial?.type === 'group' ? initial : undefined} />}
    </div>
  );
}

// --- CommandPane ---

export default function CommandPane({ instructions, setInstructions, initFormation, setInitFormation, progression, setProgression, activeId, warnings, generateError, progressionWarning, onEditingStart, onEditingEnd, onPreviewInstruction, onHoverInstruction, beat, onBeatChange }: Props) {
  const [editingId, setEditingId] = useState<InstructionId | null>(null);
  const [insertTarget, setInsertTarget] = useState<{ containerId: string; index: number } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [pasteFeedback, setPasteFeedback] = useState('');

  const dimmedIds = useMemo(
    () => computeDimmedIds(instructions, generateError?.instructionId),
    [instructions, generateError],
  );

  /** Compute beat offset and dancer scope for an insert position. */
  function computeInsertInfo(instrs: Instruction[], containerId: string, index: number): EditingInfo {
    const parsed = parseContainerId(containerId);
    if (parsed.type === 'top') {
      const startBeat = instrs.slice(0, index).reduce((s, i) => s + instructionDuration(i), 0);
      return { startBeat, scope: ALL_DANCERS };
    }
    if (parsed.type === 'group') {
      const groupBeat = findInstructionStartBeat(instrs, parsed.groupId) ?? 0;
      const group = findInstructionById(instrs, parsed.groupId);
      if (group && group.type === 'group') {
        const offset = group.instructions.slice(0, index).reduce((s, i) => s + instructionDuration(i), 0);
        return { startBeat: groupBeat + offset, scope: ALL_DANCERS };
      }
      return { startBeat: groupBeat, scope: ALL_DANCERS };
    }
    if (parsed.type === 'split') {
      const splitBeat = findInstructionStartBeat(instrs, parsed.splitId) ?? 0;
      const split = findInstructionById(instrs, parsed.splitId);
      if (split && split.type === 'split') {
        const [listA, listB] = splitLists(split);
        const [groupA, groupB] = SPLIT_GROUPS[split.by];
        const list = parsed.list === 'A' ? listA : listB;
        const scope = parsed.list === 'A' ? groupA : groupB;
        const offset = list.slice(0, index).reduce((s, i) => s + i.beats, 0);
        return { startBeat: splitBeat + offset, scope };
      }
      return { startBeat: splitBeat, scope: ALL_DANCERS };
    }
    return { startBeat: 0, scope: ALL_DANCERS };
  }

  function openInsert(containerId: string, index: number) {
    setInsertTarget({ containerId, index });
    setEditingId(null);
    const info = computeInsertInfo(instructions, containerId, index);
    onEditingStart?.(info);
  }

  function handleAdd(containerId: string, index: number, instr: Instruction) {
    const newInstructions = insertIntoContainer(instructions, containerId, instr, index);
    setInstructions(newInstructions);
    const newIndex = index + 1;
    setInsertTarget({ containerId, index: newIndex });
    const info = computeInsertInfo(newInstructions, containerId, newIndex);
    onEditingStart?.(info);
  }

  function openEdit(id: InstructionId) {
    setEditingId(id);
    setInsertTarget(null);
    const startBeat = findInstructionStartBeat(instructions, id) ?? 0;
    const scope = findInstructionScope(instructions, id);
    onEditingStart?.({ startBeat, scope });
  }

  function handleSave(id: InstructionId, updated: Instruction) {
    setInstructions(replaceInTree(instructions, id, updated));
    setEditingId(null);
    onEditingEnd?.();
    onPreviewInstruction?.(null);
  }

  function handleRemove(id: InstructionId) {
    const [newTree] = removeFromTree(instructions, id);
    setInstructions(newTree);
    if (editingId === id) {
      setEditingId(null);
      onEditingEnd?.();
      onPreviewInstruction?.(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const srcContainer = z.string().catch('top').parse(active.data.current?.sortable?.containerId);
    const overSortableContainer = z.string().optional().parse(over.data.current?.sortable?.containerId);
    const destContainer = overSortableContainer ?? String(over.id);

    if (active.id === over.id) return;

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

    const draggedId = InstructionIdSchema.parse(active.id);
    const draggedInstr = findInstructionById(instructions, draggedId);
    if (!draggedInstr) return;

    const destParsed = parseContainerId(destContainer);
    if (destParsed.type === 'split' && (draggedInstr.type === 'group' || draggedInstr.type === 'split')) return;
    if (destParsed.type === 'group' && instructionContainsId(draggedInstr, destParsed.groupId)) return;
    if (destParsed.type === 'split' && instructionContainsId(draggedInstr, destParsed.splitId)) return;

    const [treeWithout, removed] = removeFromTree(instructions, draggedId);
    if (!removed) return;

    let insertIdx: number;
    if (overSortableContainer) {
      const destItems = getContainerItems(treeWithout, destContainer);
      const overIdx = destItems ? destItems.findIndex(i => i.id === over.id) : -1;
      insertIdx = overIdx !== -1 ? overIdx : (destItems?.length ?? 0);
    } else {
      insertIdx = getContainerItems(treeWithout, destContainer)?.length ?? 0;
    }

    setInstructions(insertIntoContainer(treeWithout, destContainer, removed, insertIdx));
    if (editingId === draggedId) setEditingId(null);
    setInsertTarget(null);
  }

  function copyJson() {
    const dance = { initFormation, progression, instructions };
    navigator.clipboard.writeText(JSON.stringify(dance, null, 2));
    setCopyFeedback('Copied!');
    setTimeout(() => setCopyFeedback(''), 1500);
  }

  function tryLoadJson(text: string) {
    let raw: unknown;
    try { raw = JSON.parse(text); } catch (e) {
      setPasteFeedback(`Invalid JSON: ${e instanceof SyntaxError ? e.message : String(e)}`);
      setTimeout(() => setPasteFeedback(''), 3000);
      return;
    }
    const result = DanceSchema.safeParse(raw);
    if (!result.success) {
      setPasteFeedback(`Invalid dance:\n${formatDanceParseError(result.error, raw)}`);
      setTimeout(() => setPasteFeedback(''), 10000);
      return;
    }
    const parsed = result.data;
    setPasteFeedback('');
    setInitFormation(parsed.initFormation);
    setProgression(parsed.progression);
    setInstructions(parsed.instructions);
    setEditingId(null);
    setInsertTarget(null);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function renderAddGap(containerId: string, index: number) {
    const isOpen = insertTarget?.containerId === containerId && insertTarget.index === index;
    const allowContainers = !containerId.startsWith('split-');
    if (isOpen) {
      const insertInfo = computeInsertInfo(instructions, containerId, index);
      return (
        <InlineForm
          key={`add-${containerId}-${index}`}
          onSave={instr => handleAdd(containerId, index, instr)}
          onCancel={() => { setInsertTarget(null); onEditingEnd?.(); onPreviewInstruction?.(null); }}
          allowContainers={allowContainers}
          onPreview={onPreviewInstruction}
          startBeat={insertInfo.startBeat}
          beat={beat}
          onBeatChange={onBeatChange}
        />
      );
    }
    return (
      <div className="add-gap" key={`gap-${containerId}-${index}`}>
        <button
          className="add-gap-btn"
          onClick={() => openInsert(containerId, index)}
          title="Add instruction"
        >+</button>
      </div>
    );
  }

  function loadExampleDance(key: string) {
    const entry = exampleDances.find(d => d.key === key);
    if (!entry) return;
    const parsed = DanceSchema.safeParse(entry.dance);
    if (!parsed.success) return;
    setInitFormation(parsed.data.initFormation);
    setProgression(parsed.data.progression);
    setInstructions(parsed.data.instructions);
    setEditingId(null);
    setInsertTarget(null);
  }

  return (
    <div className="command-pane">
      {exampleDances.length > 0 && (
        <div className="dance-loader">
          <label>Load dance: </label>
          <select
            value=""
            onChange={e => { if (e.target.value) loadExampleDance(e.target.value); }}
          >
            <option value="">-- select --</option>
            {exampleDances.map(d => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="formation-selector">
        <label>Formation: </label>
        <SearchableDropdown
          options={InitFormationSchema.options}
          value={initFormation}
          onChange={v => setInitFormation(InitFormationSchema.parse(v))}
          getLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
        />
        <label> Progression: </label>
        <input type="text" inputMode="numeric" value={String(progression)} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setProgression(v); }} style={{ width: '3em' }} />
      </div>

      <h2>Instructions</h2>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="instruction-list">
          <SortableContext id="top" items={instructions.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {renderAddGap('top', 0)}
            {instructions.map((instr, i) => (
              <Fragment key={instr.id}>
                <SortableItem id={instr.id}>
                  {(dragHandleProps) => (
                    <>
                      {editingId === instr.id ? (
                        <InlineForm
                          key={`edit-${instr.id}`}
                          initial={instr}
                          onSave={updated => handleSave(instr.id, updated)}
                          onCancel={() => { setEditingId(null); onEditingEnd?.(); onPreviewInstruction?.(null); }}
                          onPreview={onPreviewInstruction}
                          startBeat={findInstructionStartBeat(instructions, instr.id) ?? 0}
                          beat={beat}
                          onBeatChange={onBeatChange}
                        />
                      ) : (
                        <div
                          className={`instruction-item${instr.id === activeId ? ' active' : ''}${dimmedIds.has(instr.id) ? ' dimmed' : ''}`}
                          onMouseEnter={() => onHoverInstruction?.(instr.id)}
                          onMouseLeave={() => onHoverInstruction?.(null)}
                        >
                          <div className="instruction-actions">
                            <button onClick={() => openEdit(instr.id)} title="Edit">{'\u270E'}</button>
                            <button onClick={() => handleRemove(instr.id)} title="Delete">{'\u00D7'}</button>
                          </div>
                          <span className="instruction-summary">{summarize(instr)}</span>
                          <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                        </div>
                      )}
                      {warnings.get(instr.id) && (
                        <div className="instruction-warning">{warnings.get(instr.id)}</div>
                      )}
                      {generateError?.instructionId === instr.id && (
                        <div className="instruction-error">{generateError.message}</div>
                      )}
                      {instr.type === 'split' && renderSplitBody(instr)}
                      {instr.type === 'group' && renderGroupBody(instr)}
                    </>
                  )}
                </SortableItem>
                {renderAddGap('top', i + 1)}
              </Fragment>
            ))}
          </SortableContext>
          <DropZone containerId="top" />
          {instructions.length === 0 && (
            <div className="instruction-empty">No instructions yet. Click + to add one.</div>
          )}
          {progressionWarning && (
            <div className="instruction-warning">{progressionWarning}</div>
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
          {pasteFeedback && <div className="paste-error">{pasteFeedback}</div>}
        </div>
      </DndContext>
    </div>
  );

  function renderGroupBody(group: Extract<Instruction, { type: 'group' }>) {
    const containerId = `group-${group.id}`;
    return (
      <div className="group-body">
        <SortableContext id={containerId} items={group.instructions.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {renderAddGap(containerId, 0)}
          {group.instructions.map((child, i) => (
            <Fragment key={child.id}>
              <SortableItem id={child.id}>
                {(dragHandleProps) => (
                  <>
                    {editingId === child.id ? (
                      <InlineForm
                        key={`edit-${child.id}`}
                        initial={child}
                        onSave={updated => handleSave(child.id, updated)}
                        onCancel={() => { setEditingId(null); onEditingEnd?.(); onPreviewInstruction?.(null); }}
                        onPreview={onPreviewInstruction}
                        startBeat={findInstructionStartBeat(instructions, child.id) ?? 0}
                        beat={beat}
                        onBeatChange={onBeatChange}
                      />
                    ) : (
                      <div
                        className={`instruction-item group-child-item${child.id === activeId ? ' active' : ''}${dimmedIds.has(child.id) ? ' dimmed' : ''}`}
                        onMouseEnter={() => onHoverInstruction?.(child.id)}
                        onMouseLeave={() => onHoverInstruction?.(null)}
                      >
                        <div className="instruction-actions">
                          <button onClick={() => openEdit(child.id)} title="Edit">{'\u270E'}</button>
                          <button onClick={() => handleRemove(child.id)} title="Delete">{'\u00D7'}</button>
                        </div>
                        <span className="instruction-summary">{summarize(child)}</span>
                        <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                      </div>
                    )}
                    {warnings.get(child.id) && (
                      <div className="instruction-warning">{warnings.get(child.id)}</div>
                    )}
                    {generateError?.instructionId === child.id && (
                      <div className="instruction-error">{generateError.message}</div>
                    )}
                    {child.type === 'split' && renderSplitBody(child)}
                    {child.type === 'group' && renderGroupBody(child)}
                  </>
                )}
              </SortableItem>
              {renderAddGap(containerId, i + 1)}
            </Fragment>
          ))}
        </SortableContext>
        <DropZone containerId={containerId} />
      </div>
    );
  }

  function renderSplitBody(split: Extract<Instruction, { type: 'split' }>) {
    const [splitListA, splitListB] = splitLists(split);
    return (
      <div className="split-body">
        {(['A', 'B'] as const).map(list => {
          const subList = list === 'A' ? splitListA : splitListB;
          const label = splitGroupLabel(split.by, list);
          const containerId = `split-${split.id}-${list}`;
          return (
            <div key={list} className="split-group">
              <div className="split-group-header">{label}:</div>
              <SortableContext id={containerId} items={subList.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {subList.map(sub => (
                  <SortableItem key={sub.id} id={sub.id}>
                    {(dragHandleProps) => (
                      editingId === sub.id ? (
                        <InlineForm
                          key={`edit-${sub.id}`}
                          initial={InstructionSchema.parse(sub)}
                          onSave={updated => handleSave(sub.id, updated)}
                          onCancel={() => { setEditingId(null); onEditingEnd?.(); onPreviewInstruction?.(null); }}
                          allowContainers={false}
                          onPreview={onPreviewInstruction}
                          startBeat={findInstructionStartBeat(instructions, sub.id) ?? 0}
                          beat={beat}
                          onBeatChange={onBeatChange}
                        />
                      ) : (
                        <div
                          className={`instruction-item split-sub-item${sub.id === activeId ? ' active' : ''}${dimmedIds.has(sub.id) ? ' dimmed' : ''}`}
                          onMouseEnter={() => onHoverInstruction?.(sub.id)}
                          onMouseLeave={() => onHoverInstruction?.(null)}
                        >
                          <div className="instruction-actions">
                            <button onClick={() => openEdit(sub.id)} title="Edit">{'\u270E'}</button>
                            <button onClick={() => handleRemove(sub.id)} title="Delete">{'\u00D7'}</button>
                          </div>
                          <span className="instruction-summary">{summarizeAtomic(sub)}</span>
                          <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                        </div>
                      )
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
              <DropZone containerId={containerId} />
              {renderAddGap(containerId, subList.length)}
            </div>
          );
        })}
      </div>
    );
  }
}
