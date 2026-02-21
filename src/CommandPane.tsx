import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SearchableDropdown from './SearchableDropdown';
import type { SearchableDropdownHandle } from './SearchableDropdown';
import { InstructionSchema, DanceSchema, AtomicInstructionSchema, InitFormationSchema, InstructionIdSchema, ActionTypeSchema, splitLists, splitWithLists, formatDanceParseError } from './types';
import type { Instruction, AtomicInstruction, SplitBy, ActionType, InitFormation, InstructionId, Dance } from './types';
import type { GenerateError } from './generate';
import { z } from 'zod';
import { assertNever } from './utils';
import { makeDefaultInstruction, makeInstructionId } from './fieldUtils';

import { TakeHandsFields } from './figures/takeHands/TakeHandsFields';
import { DropHandsFields } from './figures/dropHands/DropHandsFields';
import { AllemandeFields } from './figures/allemande/AllemandeFields';
import { DoSiDoFields } from './figures/doSiDo/DoSiDoFields';
import { CircleFields } from './figures/circle/CircleFields';
import { PullByFields } from './figures/pullBy/PullByFields';
import { StepFields } from './figures/step/StepFields';
import { BalanceFields } from './figures/balance/BalanceFields';
import { SwingFields } from './figures/swing/SwingFields';
import { BoxTheGnatFields } from './figures/boxTheGnat/BoxTheGnatFields';
import { GiveAndTakeIntoSwingFields } from './figures/giveAndTakeIntoSwing/GiveAndTakeIntoSwingFields';
import { MadRobinFields } from './figures/madRobin/MadRobinFields';
import { SplitFields } from './figures/split/SplitFields';
import { GroupFields } from './figures/group/GroupFields';

const exampleDanceModules = import.meta.glob<Dance>('/example-dances/*.json', { eager: true, import: 'default' });
const exampleDances: { key: string; label: string; dance: Dance }[] = Object.entries(exampleDanceModules).map(([path, dance]) => {
  const filename = path.split('/').pop()!.replace(/\.json$/, '');
  const fallbackName = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const displayName = dance.name || fallbackName;
  const label = dance.author ? `${displayName} (${dance.author})` : displayName;
  return { key: filename, label, dance };
});

const ACTION_OPTIONS: (ActionType | 'split' | 'group')[] = ['take_hands', 'drop_hands', 'allemande', 'do_si_do', 'swing', 'circle', 'pull_by', 'step', 'balance', 'box_the_gnat', 'give_and_take_into_swing', 'mad_robin', 'split', 'group'];
const ACTION_LABELS: Record<string, string> = {
  take_hands: 'take hands', drop_hands: 'drop hands', allemande: 'allemande',
  do_si_do: 'do-si-do', swing: 'swing', circle: 'circle', pull_by: 'pull by',
  step: 'step', balance: 'balance',
  box_the_gnat: 'box the gnat', give_and_take_into_swing: 'give & take into swing',
  mad_robin: 'mad robin',
  split: 'split', group: 'group',
};

function splitGroupLabel(by: SplitBy['by'], list: 'A' | 'B'): string {
  if (by === 'role') return list === 'A' ? 'Larks' : 'Robins';
  return list === 'A' ? 'Ups' : 'Downs';
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
  onHoverInstruction?: (id: InstructionId | null) => void;
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

// --- InlineForm: always-visible instruction editor ---

function InlineForm({ instruction, onChange, autoFocusAction, allowContainers = true }: {
  instruction: Instruction;
  onChange: (instr: Instruction) => void;
  autoFocusAction?: boolean;
  allowContainers?: boolean;
}) {
  const actionRef = useRef<SearchableDropdownHandle>(null);
  const [valid, setValid] = useState(true);

  useEffect(() => {
    if (autoFocusAction) actionRef.current?.focus();
  }, [autoFocusAction]);

  const actionOptions = allowContainers
    ? ACTION_OPTIONS
    : ACTION_OPTIONS.filter(o => o !== 'split' && o !== 'group');

  function handleActionChange(newAction: string) {
    const parsed = z.union([ActionTypeSchema, z.literal('split'), z.literal('group')]).parse(newAction);
    if (parsed !== instruction.type) {
      onChange(makeDefaultInstruction(parsed, instruction.id));
      setValid(true);
    }
  }

  function handleFieldChange(updated: Instruction) {
    onChange(updated);
    setValid(true);
  }

  function handleInvalid() {
    setValid(false);
  }

  const common = { onChange: handleFieldChange, onInvalid: handleInvalid };

  return (
    <span className={`inline-form${valid ? '' : ' invalid'}`}>
      <SearchableDropdown
        ref={actionRef}
        options={actionOptions}
        value={instruction.type}
        onChange={handleActionChange}
        getLabel={v => ACTION_LABELS[v] ?? v}
      />
      {(() => { switch (instruction.type) {
        case 'take_hands': return <TakeHandsFields {...common} instruction={instruction} />;
        case 'drop_hands': return <DropHandsFields {...common} instruction={instruction} />;
        case 'allemande': return <AllemandeFields {...common} instruction={instruction} />;
        case 'do_si_do': return <DoSiDoFields {...common} instruction={instruction} />;
        case 'circle': return <CircleFields {...common} instruction={instruction} />;
        case 'pull_by': return <PullByFields {...common} instruction={instruction} />;
        case 'step': return <StepFields {...common} instruction={instruction} />;
        case 'balance': return <BalanceFields {...common} instruction={instruction} />;
        case 'swing': return <SwingFields {...common} instruction={instruction} />;
        case 'box_the_gnat': return <BoxTheGnatFields {...common} instruction={instruction} />;
        case 'give_and_take_into_swing': return <GiveAndTakeIntoSwingFields {...common} instruction={instruction} />;
        case 'mad_robin': return <MadRobinFields {...common} instruction={instruction} />;
        case 'split': return <SplitFields {...common} instruction={instruction} />;
        case 'group': return <GroupFields {...common} instruction={instruction} />;
        default: assertNever(instruction);
      }})()}
    </span>
  );
}

// --- CommandPane ---

export default function CommandPane({ instructions, setInstructions, initFormation, setInitFormation, progression, setProgression, activeId, warnings, generateError, progressionWarning, onHoverInstruction }: Props) {
  const [newlyAddedId, setNewlyAddedId] = useState<InstructionId | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [pasteFeedback, setPasteFeedback] = useState('');

  // Clear newlyAddedId after render so autofocus fires only once
  useEffect(() => {
    if (newlyAddedId) setNewlyAddedId(null);
  }, [newlyAddedId]);

  const dimmedIds = useMemo(
    () => computeDimmedIds(instructions, generateError?.instructionId),
    [instructions, generateError],
  );

  function handleChange(id: InstructionId, updated: Instruction) {
    setInstructions(replaceInTree(instructions, id, updated));
  }

  function handleAdd(containerId: string, index: number) {
    const id = makeInstructionId();
    const defaultInstr = makeDefaultInstruction('step', id);
    const newInstructions = insertIntoContainer(instructions, containerId, defaultInstr, index);
    setInstructions(newInstructions);
    setNewlyAddedId(id);
  }

  function handleRemove(id: InstructionId) {
    const [newTree] = removeFromTree(instructions, id);
    setInstructions(newTree);
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
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function renderAddGap(containerId: string, index: number) {
    return (
      <div className="add-gap" key={`gap-${containerId}-${index}`}>
        <button
          className="add-gap-btn"
          onClick={() => handleAdd(containerId, index)}
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
  }

  function renderInstruction(instr: Instruction, dragHandleProps: Record<string, unknown>, options?: { extraClass?: string; inSplit?: boolean }) {
    return (
      <>
        <div
          className={`instruction-item${options?.extraClass ? ' ' + options.extraClass : ''}${instr.id === activeId ? ' active' : ''}${dimmedIds.has(instr.id) ? ' dimmed' : ''}`}
          onMouseEnter={() => onHoverInstruction?.(instr.id)}
          onMouseLeave={() => onHoverInstruction?.(null)}
        >
          <div className="instruction-actions">
            <button onClick={() => handleRemove(instr.id)} title="Delete">{'\u00D7'}</button>
          </div>
          <InlineForm
            key={instr.type}
            instruction={instr}
            onChange={updated => handleChange(instr.id, updated)}
            autoFocusAction={newlyAddedId === instr.id}
            allowContainers={!options?.inSplit}
          />
          <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
        </div>
        {warnings.get(instr.id) && (
          <div className="instruction-warning">{warnings.get(instr.id)}</div>
        )}
        {generateError?.instructionId === instr.id && (
          <div className="instruction-error">{generateError.message}</div>
        )}
      </>
    );
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
                      {renderInstruction(instr, dragHandleProps)}
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
                    {renderInstruction(child, dragHandleProps, { extraClass: 'group-child-item' })}
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
                    {(dragHandleProps) =>
                      renderInstruction(InstructionSchema.parse(sub), dragHandleProps, { extraClass: 'split-sub-item', inSplit: true })
                    }
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
