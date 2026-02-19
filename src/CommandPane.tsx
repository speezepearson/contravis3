import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SearchableDropdown from './SearchableDropdown';
import type { SearchableDropdownHandle } from './SearchableDropdown';
import { InstructionSchema, DanceSchema, RelativeDirectionSchema, RelationshipSchema, DropHandsTargetSchema, HandSchema, TakeHandSchema, ActionTypeSchema, AtomicInstructionSchema, InitFormationSchema, InstructionIdSchema, RoleSchema, splitLists, splitWithLists } from './types';
import type { Instruction, AtomicInstruction, Relationship, RelativeDirection, SplitBy, DropHandsTarget, ActionType, InitFormation, TakeHand, InstructionId, Role } from './types';
import type { GenerateError } from './generate';
import { z } from 'zod';

const DIR_OPTIONS = ['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left', 'partner', 'neighbor', 'opposite'];

const ACTION_OPTIONS: (ActionType | 'split' | 'group')[] = ['take_hands', 'drop_hands', 'allemande', 'do_si_do', 'swing', 'circle', 'pull_by', 'turn', 'step', 'balance', 'box_the_gnat', 'give_and_take_into_swing', 'mad_robin', 'robins_chain', 'split', 'group'];
const ACTION_LABELS: Record<string, string> = {
  take_hands: 'take hands', drop_hands: 'drop hands', allemande: 'allemande',
  do_si_do: 'do-si-do', swing: 'swing', circle: 'circle', pull_by: 'pull by',
  turn: 'turn', step: 'step', balance: 'balance',
  box_the_gnat: 'box the gnat', give_and_take_into_swing: 'give & take into swing',
  mad_robin: 'mad robin', robins_chain: 'robins chain',
  split: 'split', group: 'group',
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

function splitGroupLabel(by: SplitBy['by'], list: 'A' | 'B'): string {
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
    case 'box_the_gnat': return '4';
    case 'give_and_take_into_swing': return '16';
    case 'mad_robin':  return '8';
    case 'robins_chain': return '8';
    default:          return '0';
  }
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
    case 'box_the_gnat': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : r;
      return `${label} box the gnat (${instr.beats}b)`;
    }
    case 'give_and_take_into_swing': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : r;
      const ef = instr.endFacing.kind === 'direction' ? instr.endFacing.value : instr.endFacing.value;
      return `${instr.role}s give & take ${label} into swing \u2192 ${ef} (${instr.beats}b)`;
    }
    case "mad_robin": {
      const dirLabel =
        instr.dir === "larks_in_middle"
          ? "larks in middle"
          : "robins in middle";
      const withLabel =
        instr.with === "larks_left" ? "larks' left" : "robins' left";
      return `mad robin ${dirLabel}, ${withLabel} ${instr.rotations}x (${instr.beats}b)`;
    }
    case 'robins_chain': {
      const r = instr.relationship;
      const label = r === 'on_right' ? 'on-your-right' : r === 'on_left' ? 'on-your-left' : r === 'in_front' ? 'in-front' : r;
      return `${label} robins chain (${instr.beats}b)`;
    }
  }
}

function instrDuration(instr: Instruction): number {
  if (instr.type === 'split') {
    const [listA, listB] = splitLists(instr);
    return Math.max(sumBeats(listA), sumBeats(listB));
  }
  if (instr.type === 'group')
    return instr.instructions.reduce((s, i) => s + instrDuration(i), 0);
  return instr.beats;
}

function summarize(instr: Instruction): string {
  if (instr.type === 'split') {
    const [listA, listB] = splitLists(instr);
    const totalBeats = Math.max(sumBeats(listA), sumBeats(listB));
    return `split by ${instr.by} (${totalBeats}b)`;
  }
  if (instr.type === 'group') {
    const totalBeats = instrDuration(instr);
    return `${instr.label} (${totalBeats}b)`;
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

// --- SaveCancelButtons ---

function SaveCancelButtons({ isEditing, onSave, onCancel }: { isEditing: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="builder-buttons">
      <button className="add-btn" onClick={onSave}>{isEditing ? 'Save' : 'Add'}</button>
      <button className="cancel-btn" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// --- Per-action sub-form components ---

interface SubFormProps {
  id: InstructionId;
  isEditing: boolean;
  onSave: (instr: Instruction) => void;
  onCancel: () => void;
}

function TakeHandsFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'take_hands' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [hand, setHand] = useState<TakeHand>(initial?.hand ?? 'right');

  function save() {
    onSave(InstructionSchema.parse({ id, beats: 0, type: 'take_hands', relationship, hand }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Hand
      <SearchableDropdown options={TAKE_HAND_OPTIONS} value={hand} onChange={v => setHand(TakeHandSchema.parse(v))} getLabel={v => v} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function DropHandsFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'drop_hands' }> }) {
  const [dropTarget, setDropTarget] = useState<DropHandsTarget>(initial?.target ?? 'neighbor');

  function save() {
    onSave(InstructionSchema.parse({ id, beats: 0, type: 'drop_hands', target: dropTarget }));
  }

  return (<>
    <label>
      Drop
      <SearchableDropdown options={DROP_TARGET_OPTIONS} value={dropTarget} onChange={v => setDropTarget(DropHandsTargetSchema.parse(v))} getLabel={v => DROP_TARGET_LABELS[v] ?? v} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function AllemandeFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'allemande' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [handedness, setHandedness] = useState<'left' | 'right'>(initial?.handedness ?? 'right');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('allemande'));

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'allemande', beats: Number(beats) || 0, relationship, handedness, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Hand
      <SearchableDropdown options={HAND_OPTIONS} value={handedness} onChange={v => setHandedness(HandSchema.parse(v))} getLabel={v => v} />
    </label>
    <label>
      Rotations
      <input type="text" inputMode="decimal" value={rotations} onChange={e => setRotations(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function DoSiDoFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'do_si_do' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('do_si_do'));

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'do_si_do', beats: Number(beats) || 0, relationship, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Rotations
      <input type="text" inputMode="decimal" value={rotations} onChange={e => setRotations(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function CircleFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'circle' }> }) {
  const [direction, setDirection] = useState<'left' | 'right'>(initial?.direction ?? 'left');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('circle'));

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'circle', beats: Number(beats) || 0, direction, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      Direction
      <SearchableDropdown options={CIRCLE_DIR_OPTIONS} value={direction} onChange={v => setDirection(HandSchema.parse(v))} getLabel={v => v} />
    </label>
    <label>
      Rotations
      <input type="text" inputMode="decimal" value={rotations} onChange={e => setRotations(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function PullByFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'pull_by' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [hand, setHand] = useState<'left' | 'right'>(initial?.hand ?? 'right');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('pull_by'));

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'pull_by', beats: Number(beats) || 0, relationship, hand }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Hand
      <SearchableDropdown options={HAND_OPTIONS} value={hand} onChange={v => setHand(HandSchema.parse(v))} getLabel={v => v} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function TurnFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'turn' }> }) {
  const [targetText, setTargetText] = useState(initial ? directionToText(initial.target) : '');
  const [offset, setOffset] = useState(initial ? String(initial.offset) : '0');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('turn'));

  function save() {
    const target = parseDirection(targetText) ?? { kind: 'direction' as const, value: 'up' as const };
    onSave(InstructionSchema.parse({ id, type: 'turn', beats: Number(beats) || 0, target, offset: Number(offset) || 0 }));
  }

  return (<>
    <label>
      Target
      <SearchableDropdown options={DIR_OPTIONS} value={targetText} onChange={setTargetText} placeholder="e.g. across, partner" />
    </label>
    <label>
      Offset
      <input type="text" inputMode="decimal" value={offset} onChange={e => setOffset(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function StepFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'step' }> }) {
  const [dirText, setDirText] = useState(initial ? directionToText(initial.direction) : '');
  const [distance, setDistance] = useState(initial ? String(initial.distance) : '0.5');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('step'));

  function save() {
    const dir = parseDirection(dirText) ?? { kind: 'direction' as const, value: 'up' as const };
    onSave(InstructionSchema.parse({ id, type: 'step', beats: Number(beats) || 0, direction: dir, distance: Number(distance) || 0 }));
  }

  return (<>
    <label>
      Direction
      <SearchableDropdown options={DIR_OPTIONS} value={dirText} onChange={setDirText} placeholder="e.g. across, partner, 45" />
    </label>
    <label>
      Distance
      <input type="text" inputMode="decimal" value={distance} onChange={e => setDistance(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function BalanceFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'balance' }> }) {
  const [dirText, setDirText] = useState(initial ? directionToText(initial.direction) : '');
  const [distance, setDistance] = useState(initial ? String(initial.distance) : '0.5');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('balance'));

  function save() {
    const dir = parseDirection(dirText) ?? { kind: 'direction' as const, value: 'across' as const };
    onSave(InstructionSchema.parse({ id, type: 'balance', beats: Number(beats) || 0, direction: dir, distance: Number(distance) || 0 }));
  }

  return (<>
    <label>
      Direction
      <SearchableDropdown options={DIR_OPTIONS} value={dirText} onChange={setDirText} placeholder="e.g. across, partner, 45" />
    </label>
    <label>
      Distance
      <input type="text" inputMode="decimal" value={distance} onChange={e => setDistance(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function SwingFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'swing' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [endFacingText, setEndFacingText] = useState(initial ? directionToText(initial.endFacing) : 'across');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('swing'));

  function save() {
    const endFacing = parseDirection(endFacingText) ?? { kind: 'direction' as const, value: 'across' as const };
    onSave(InstructionSchema.parse({ id, type: 'swing', beats: Number(beats) || 0, relationship, endFacing }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      End facing
      <SearchableDropdown options={DIR_OPTIONS} value={endFacingText} onChange={setEndFacingText} placeholder="e.g. across, up" />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

const ROLE_OPTIONS: Role[] = ['lark', 'robin'];

function BoxTheGnatFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'box_the_gnat' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('box_the_gnat'));

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'box_the_gnat', beats: Number(beats) || 0, relationship }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function GiveAndTakeIntoSwingFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'neighbor');
  const [role, setRole] = useState<Role>(initial?.role ?? 'lark');
  const [endFacingText, setEndFacingText] = useState(initial ? directionToText(initial.endFacing) : 'across');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('give_and_take_into_swing'));

  function save() {
    const endFacing = parseDirection(endFacingText) ?? { kind: 'direction' as const, value: 'across' as const };
    onSave(InstructionSchema.parse({ id, type: 'give_and_take_into_swing', beats: Number(beats) || 0, relationship, role, endFacing }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    </label>
    <label>
      Who draws
      <SearchableDropdown options={ROLE_OPTIONS} value={role} onChange={v => setRole(RoleSchema.parse(v))} getLabel={v => v} />
    </label>
    <label>
      End facing
      <SearchableDropdown options={DIR_OPTIONS} value={endFacingText} onChange={setEndFacingText} placeholder="e.g. across, up" />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

const MAD_ROBIN_DIR_OPTIONS = ['larks_in_middle', 'robins_in_middle'];
const MAD_ROBIN_DIR_LABELS: Record<string, string> = { larks_in_middle: 'larks in middle', robins_in_middle: 'robins in middle' };
const MAD_ROBIN_WITH_OPTIONS = ['larks_left', 'robins_left'];
const MAD_ROBIN_WITH_LABELS: Record<string, string> = { larks_left: "larks' left", robins_left: "robins' left" };

function MadRobinFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'mad_robin' }> }) {
  const [dir, setDir] = useState<'larks_in_middle' | 'robins_in_middle'>(initial?.dir ?? 'larks_in_middle');
  const [withDir, setWithDir] = useState<'larks_left' | 'robins_left'>(initial?.with ?? 'larks_left');
  const [rotations, setRotations] = useState(initial ? String(initial.rotations) : '1');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('mad_robin'));

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'mad_robin', beats: Number(beats) || 0, dir, with: withDir, rotations: Number(rotations) || 1 }));
  }

  return (<>
    <label>
      Direction
      <SearchableDropdown options={MAD_ROBIN_DIR_OPTIONS} value={dir} onChange={v => setDir(z.enum(['larks_in_middle', 'robins_in_middle']).parse(v))} getLabel={v => MAD_ROBIN_DIR_LABELS[v] ?? v} />
    </label>
    <label>
      With
      <SearchableDropdown options={MAD_ROBIN_WITH_OPTIONS} value={withDir} onChange={v => setWithDir(z.enum(['larks_left', 'robins_left']).parse(v))} getLabel={v => MAD_ROBIN_WITH_LABELS[v] ?? v} />
    </label>
    <label>
      Rotations
      <input type="text" inputMode="decimal" value={rotations} onChange={e => setRotations(e.target.value)} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function RobinsChainFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<AtomicInstruction, { type: 'robins_chain' }> }) {
  const [relationship, setRelationship] = useState<Relationship>(initial?.relationship ?? 'partner');
  const [beats, setBeats] = useState(initial ? String(initial.beats) : defaultBeats('robins_chain'));

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'robins_chain', beats: Number(beats) || 0, relationship }));
  }

  return (<>
    <label>
      With
      <SearchableDropdown options={RELATIONSHIP_OPTIONS} value={relationship} onChange={v => setRelationship(RelationshipSchema.parse(v))} getLabel={v => v} />
    </label>
    <label>
      Beats
      <input type="text" inputMode="decimal" value={beats} onChange={e => setBeats(e.target.value)} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function SplitFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<Instruction, { type: 'split' }> }) {
  const [splitBy, setSplitBy] = useState<SplitBy['by']>(initial?.by ?? 'role');

  function save() {
    const [listA, listB] = initial ? splitLists(initial) : [[], []];
    onSave(InstructionSchema.parse({ id, type: 'split', ...splitWithLists(splitBy, listA, listB) }));
  }

  return (<>
    <label>
      Split by
      <SearchableDropdown options={SPLIT_BY_OPTIONS} value={splitBy} onChange={v => setSplitBy(z.enum(['role', 'position']).parse(v))} getLabel={v => SPLIT_BY_LABELS[v] ?? v} />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

function GroupFields({ id, isEditing, initial, onSave, onCancel }: SubFormProps & { initial?: Extract<Instruction, { type: 'group' }> }) {
  const [label, setLabel] = useState(initial?.label ?? '');

  function save() {
    onSave(InstructionSchema.parse({ id, type: 'group', label: label || 'Untitled', instructions: initial?.instructions ?? [] }));
  }

  return (<>
    <label>
      Label
      <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Allemande figure" />
    </label>
    <SaveCancelButtons isEditing={isEditing} onSave={save} onCancel={onCancel} />
  </>);
}

// --- InlineForm: self-contained instruction editor ---

function InlineForm({ initial, onSave, onCancel, allowContainers = true }: {
  initial?: Instruction;
  onSave: (instr: Instruction) => void;
  onCancel: () => void;
  allowContainers?: boolean;
}) {
  const [action, setAction] = useState<ActionType | 'split' | 'group'>(() => {
    if (!initial) return 'take_hands';
    if (initial.type === 'split') return 'split';
    if (initial.type === 'group') return 'group';
    return initial.type;
  });

  const actionRef = useRef<SearchableDropdownHandle>(null);
  useEffect(() => { actionRef.current?.focus(); }, []);
  const [id] = useState(() => initial ? initial.id : makeInstructionId());
  const isEditing = !!initial;
  const common = { id, isEditing, onSave, onCancel };

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
      {action === 'robins_chain' && <RobinsChainFields {...common} initial={initial?.type === 'robins_chain' ? initial : undefined} />}
      {action === 'split' && <SplitFields {...common} initial={initial?.type === 'split' ? initial : undefined} />}
      {action === 'group' && <GroupFields {...common} initial={initial?.type === 'group' ? initial : undefined} />}
    </div>
  );
}

// --- CommandPane ---

export default function CommandPane({ instructions, setInstructions, initFormation, setInitFormation, progression, setProgression, activeId, warnings, generateError, progressionWarning }: Props) {
  const [editingId, setEditingId] = useState<InstructionId | null>(null);
  const [insertTarget, setInsertTarget] = useState<{ containerId: string; index: number } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [pasteFeedback, setPasteFeedback] = useState('');

  const dimmedIds = useMemo(
    () => computeDimmedIds(instructions, generateError?.instructionId),
    [instructions, generateError],
  );

  function openInsert(containerId: string, index: number) {
    setInsertTarget({ containerId, index });
    setEditingId(null);
  }

  function handleAdd(containerId: string, index: number, instr: Instruction) {
    setInstructions(insertIntoContainer(instructions, containerId, instr, index));
    setInsertTarget({ containerId, index: index + 1 });
  }

  function openEdit(id: InstructionId) {
    setEditingId(id);
    setInsertTarget(null);
  }

  function handleSave(id: InstructionId, updated: Instruction) {
    setInstructions(replaceInTree(instructions, id, updated));
    setEditingId(null);
  }

  function handleRemove(id: InstructionId) {
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
      setPasteFeedback(`Invalid dance: ${result.error.issues.map(i => i.message).join(', ')}`);
      setTimeout(() => setPasteFeedback(''), 3000);
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
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <div className={`instruction-item${instr.id === activeId ? ' active' : ''}${dimmedIds.has(instr.id) ? ' dimmed' : ''}`}>
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
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <div className={`instruction-item group-child-item${child.id === activeId ? ' active' : ''}${dimmedIds.has(child.id) ? ' dimmed' : ''}`}>
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
                          onCancel={() => setEditingId(null)}
                          allowContainers={false}
                        />
                      ) : (
                        <div className={`instruction-item split-sub-item${sub.id === activeId ? ' active' : ''}${dimmedIds.has(sub.id) ? ' dimmed' : ''}`}>
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
