import { useState, useRef, useEffect, Fragment } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SearchableDropdown from './SearchableDropdown';
import type { SearchableDropdownHandle } from './SearchableDropdown';
import { InstructionSchema, DanceSchema, RelativeDirectionSchema, RelationshipSchema, SplitBySchema, DropHandsTargetSchema, HandSchema, TakeHandSchema, ActionTypeSchema, AtomicInstructionSchema, InitFormationSchema } from './types';
import type { Instruction, AtomicInstruction, Relationship, RelativeDirection, SplitBy, DropHandsTarget, ActionType, InitFormation, TakeHand } from './types';
import type { GenerateError } from './generate';
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
const TAKE_HAND_OPTIONS = ['right', 'left', 'both', 'inside'];
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

function replaceInTree(instrs: Instruction[], id: number, replacement: Instruction): Instruction[] {
  return instrs.map(i => {
    if (i.id === id) return replacement;
    if (i.type === 'split') {
      return {
        ...i,
        listA: i.listA.map(sub => sub.id === id ? AtomicInstructionSchema.parse(replacement) : sub),
        listB: i.listB.map(sub => sub.id === id ? AtomicInstructionSchema.parse(replacement) : sub),
      };
    }
    if (i.type === 'group') {
      return { ...i, instructions: replaceInTree(i.instructions, id, replacement) };
    }
    return i;
  });
}

interface Props {
  instructions: Instruction[];
  setInstructions: (instructions: Instruction[]) => void;
  initFormation: InitFormation;
  setInitFormation: (formation: InitFormation) => void;
  activeId: number | null;
  warnings: Map<number, string>;
  generateError: GenerateError | null;
}

function summarizeAtomic(instr: AtomicInstruction): string {
  switch (instr.type) {
    case 'take_hands': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : `${r}s`;
      const handLabel = instr.hand === 'both' ? 'both' : instr.hand;
      return `${label} take ${handLabel} hands`;
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

// --- InlineForm: self-contained instruction editor ---

function InlineForm({ initial, onSave, onCancel, allowContainers = true }: {
  initial?: Instruction;
  onSave: (instr: Instruction) => void;
  onCancel: () => void;
  allowContainers?: boolean;
}) {
  const initAtomic: AtomicInstruction | null =
    initial && initial.type !== 'split' && initial.type !== 'group' ? initial : null;

  const [action, setAction] = useState<ActionType | 'split' | 'group'>(() => {
    if (!initial) return 'take_hands';
    if (initial.type === 'split') return 'split';
    if (initial.type === 'group') return 'group';
    return initial.type;
  });
  const [relationship, setRelationship] = useState<Relationship>(() => {
    if (initAtomic?.type === 'take_hands' || initAtomic?.type === 'allemande' ||
        initAtomic?.type === 'do_si_do' || initAtomic?.type === 'pull_by' || initAtomic?.type === 'swing')
      return initAtomic.relationship;
    return 'neighbor';
  });
  const [dropTarget, setDropTarget] = useState<DropHandsTarget>(
    initAtomic?.type === 'drop_hands' ? initAtomic.target : 'neighbor'
  );
  const [hand, setHand] = useState<TakeHand>(() => {
    if (initAtomic?.type === 'take_hands' || initAtomic?.type === 'pull_by') return initAtomic.hand;
    return 'right';
  });
  const [handedness, setHandedness] = useState<'left' | 'right'>(() => {
    if (initAtomic?.type === 'allemande') return initAtomic.handedness;
    if (initAtomic?.type === 'circle') return initAtomic.direction;
    return 'right';
  });
  const [rotations, setRotations] = useState(() => {
    if (initAtomic?.type === 'allemande' || initAtomic?.type === 'do_si_do' || initAtomic?.type === 'circle')
      return String(initAtomic.rotations);
    return '1';
  });
  const [turnText, setTurnText] = useState(() => {
    if (initAtomic?.type === 'turn') return directionToText(initAtomic.target);
    if (initAtomic?.type === 'swing') return directionToText(initAtomic.endFacing);
    return '';
  });
  const [turnOffset, setTurnOffset] = useState(
    initAtomic?.type === 'turn' ? String(initAtomic.offset) : '0'
  );
  const [stepText, setStepText] = useState(
    initAtomic?.type === 'step' ? directionToText(initAtomic.direction) : ''
  );
  const [balanceText, setBalanceText] = useState(
    initAtomic?.type === 'balance' ? directionToText(initAtomic.direction) : ''
  );
  const [distance, setDistance] = useState(() => {
    if (initAtomic?.type === 'step' || initAtomic?.type === 'balance') return String(initAtomic.distance);
    return '0.5';
  });
  const [beats, setBeats] = useState(initAtomic ? String(initAtomic.beats) : '0');
  const [splitBy, setSplitBy] = useState<SplitBy>(
    initial?.type === 'split' ? initial.by : 'role'
  );
  const [groupLabel, setGroupLabel] = useState(
    initial?.type === 'group' ? initial.label : ''
  );

  const actionRef = useRef<SearchableDropdownHandle>(null);
  useEffect(() => { actionRef.current?.focus(); }, []);

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
        return { ...base, type: 'pull_by', relationship, hand: HandSchema.parse(hand) };
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

  function save() {
    const id = initial ? initial.id : nextId++;
    let raw;
    if (action === 'group') {
      const existingChildren = initial?.type === 'group' ? initial.instructions : [];
      raw = { id, type: 'group', label: groupLabel || 'Untitled', instructions: existingChildren };
    } else if (action === 'split') {
      const existingListA = initial?.type === 'split' ? initial.listA : [];
      const existingListB = initial?.type === 'split' ? initial.listB : [];
      raw = { id, type: 'split', by: splitBy, listA: existingListA, listB: existingListB };
    } else {
      raw = buildAtomicInstruction(id);
    }
    onSave(InstructionSchema.parse(raw));
  }

  const actionOptions = allowContainers
    ? ACTION_OPTIONS
    : ACTION_OPTIONS.filter(o => o !== 'split' && o !== 'group');

  return (
    <div className="inline-form">
      <label>
        Action
        <SearchableDropdown
          ref={actionRef}
          options={actionOptions}
          value={action}
          onChange={v => {
            const a = z.union([ActionTypeSchema, z.literal('split'), z.literal('group')]).parse(v);
            setAction(a);
            if (!initial) {
              setBeats(defaultBeats(a));
              if (a === 'swing') setTurnText('across');
            }
            if (a === 'pull_by' && hand === 'both') setHand('right');
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

      {action === 'take_hands' && (
        <label>
          Hand
          <SearchableDropdown
            options={TAKE_HAND_OPTIONS}
            value={hand}
            onChange={v => setHand(TakeHandSchema.parse(v))}
            getLabel={v => v}
          />
        </label>
      )}

      {action === 'pull_by' && (
        <label>
          Hand
          <SearchableDropdown
            options={HAND_OPTIONS}
            value={hand}
            onChange={v => setHand(HandSchema.parse(v))}
            getLabel={v => v}
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
              getLabel={v => v}
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
              getLabel={v => v}
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

      {action !== 'split' && action !== 'group' && action !== 'take_hands' && action !== 'drop_hands' && (
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
        <button className="add-btn" onClick={save}>{initial ? 'Save' : 'Add'}</button>
        <button className="cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// --- CommandPane ---

export default function CommandPane({ instructions, setInstructions, initFormation, setInitFormation, activeId, warnings, generateError }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [insertTarget, setInsertTarget] = useState<{ containerId: string; index: number } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  function openInsert(containerId: string, index: number) {
    setInsertTarget({ containerId, index });
    setEditingId(null);
  }

  function handleAdd(containerId: string, index: number, instr: Instruction) {
    setInstructions(insertIntoContainer(instructions, containerId, instr, index));
    setInsertTarget({ containerId, index: index + 1 });
  }

  function openEdit(id: number) {
    setEditingId(id);
    setInsertTarget(null);
  }

  function handleSave(id: number, updated: Instruction) {
    setInstructions(replaceInTree(instructions, id, updated));
    setEditingId(null);
  }

  function handleRemove(id: number) {
    const [newTree] = removeFromTree(instructions, id);
    setInstructions(newTree);
    if (editingId === id) setEditingId(null);
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

    const draggedId = z.number().parse(active.id);
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
    setInsertTarget(null);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function renderAddGap(containerId: string, index: number) {
    const isOpen = insertTarget?.containerId === containerId && insertTarget.index === index;
    const allowContainers = !containerId.startsWith('split-');
    if (isOpen) {
      return (
        <InlineForm
          key={`add-${containerId}-${index}`}
          onSave={instr => handleAdd(containerId, index, instr)}
          onCancel={() => setInsertTarget(null)}
          allowContainers={allowContainers}
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

  return (
    <div className="command-pane">
      <div className="formation-selector">
        <label>Formation: </label>
        <SearchableDropdown
          options={InitFormationSchema.options}
          value={initFormation}
          onChange={v => setInitFormation(InitFormationSchema.parse(v))}
          getLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
        />
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
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <div className={`instruction-item${instr.id === activeId ? ' active' : ''}`}>
                          <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                          <span className="instruction-summary">{summarize(instr)}</span>
                          <div className="instruction-actions">
                            <button onClick={() => openEdit(instr.id)} title="Edit">{'\u270E'}</button>
                            <button onClick={() => handleRemove(instr.id)} title="Delete">{'\u00D7'}</button>
                          </div>
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
                  {editingId === child.id ? (
                    <InlineForm
                      key={`edit-${child.id}`}
                      initial={child}
                      onSave={updated => handleSave(child.id, updated)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className={`instruction-item group-child-item${child.id === activeId ? ' active' : ''}`}>
                      <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                      <span className="instruction-summary">{summarize(child)}</span>
                      <div className="instruction-actions">
                        <button onClick={() => openEdit(child.id)} title="Edit">{'\u270E'}</button>
                        <button onClick={() => handleRemove(child.id)} title="Delete">{'\u00D7'}</button>
                      </div>
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
          ))}
        </SortableContext>
        <DropZone containerId={containerId} />
        {renderAddGap(containerId, group.instructions.length)}
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
                      editingId === sub.id ? (
                        <InlineForm
                          key={`edit-${sub.id}`}
                          initial={InstructionSchema.parse(sub)}
                          onSave={updated => handleSave(sub.id, updated)}
                          onCancel={() => setEditingId(null)}
                          allowContainers={false}
                        />
                      ) : (
                        <div className={`instruction-item split-sub-item${sub.id === activeId ? ' active' : ''}`}>
                          <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                          <span className="instruction-summary">{summarizeAtomic(sub)}</span>
                          <div className="instruction-actions">
                            <button onClick={() => openEdit(sub.id)} title="Edit">{'\u270E'}</button>
                            <button onClick={() => handleRemove(sub.id)} title="Delete">{'\u00D7'}</button>
                          </div>
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
