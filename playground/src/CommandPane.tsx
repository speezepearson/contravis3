import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SearchableDropdown from './SearchableDropdown';
import type { Instruction, AtomicInstruction, Relationship, RelativeDirection, SplitBy, DropHandsTarget } from './types';

type ActionType = AtomicInstruction['type'];

const DIR_OPTIONS = ['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left', 'partner', 'neighbor', 'opposite'];

function parseDirection(text: string): RelativeDirection | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  const directions = new Set(['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left']);
  const relationships = new Set(['partner', 'neighbor', 'opposite']);
  if (directions.has(trimmed)) return { kind: 'direction', value: trimmed as RelativeDirection & { kind: 'direction' } extends { value: infer V } ? V : never };
  if (relationships.has(trimmed)) return { kind: 'relationship', value: trimmed as Relationship };
  const num = Number(trimmed);
  if (!isNaN(num)) return { kind: 'cw', value: num };
  return null;
}

function directionToText(dir: RelativeDirection): string {
  if (dir.kind === 'direction') return dir.value;
  if (dir.kind === 'relationship') return dir.value;
  return String(dir.value);
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
    case 'step':      return '2';
    case 'balance':   return '4';
    default:          return '0';
  }
}

let nextId = 1;

interface Props {
  instructions: Instruction[];
  setInstructions: (instructions: Instruction[]) => void;
}

type BuilderContext =
  | { level: 'top' }
  | { level: 'sub'; splitId: number; list: 'A' | 'B' };

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
    case 'turn': {
      const t = instr.target;
      const desc = t.kind === 'direction' ? t.value
        : t.kind === 'cw' ? `${t.value}\u00B0`
        : t.value;
      const offsetStr = instr.offset ? ` +${instr.offset}\u00B0` : '';
      return `turn ${desc}${offsetStr} (${instr.beats}b)`;
    }
    case 'step': {
      const t = instr.direction;
      const desc = t.kind === 'direction' ? t.value
        : t.kind === 'cw' ? `${t.value}\u00B0`
        : t.value;
      return `step ${desc} ${instr.distance} (${instr.beats}b)`;
    }
    case 'balance': {
      const t = instr.direction;
      const desc = t.kind === 'direction' ? t.value
        : t.kind === 'cw' ? `${t.value}\u00B0`
        : t.value;
      return `balance ${desc} ${instr.distance} (${instr.beats}b)`;
    }
  }
}

function summarize(instr: Instruction): string {
  if (instr.type === 'split') {
    const beatsA = sumBeats(instr.listA);
    const beatsB = sumBeats(instr.listB);
    const totalBeats = Math.max(beatsA, beatsB);
    return `split by ${instr.by} (${totalBeats}b)`;
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

export default function CommandPane({ instructions, setInstructions }: Props) {
  const [context, setContext] = useState<BuilderContext>({ level: 'top' });
  const [action, setAction] = useState<ActionType | 'split'>('take_hands');
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
  const [editingId, setEditingId] = useState<number | null>(null);

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
    } else if (instr.type === 'turn') {
      setTurnText(directionToText(instr.target));
      setTurnOffset(String(instr.offset));
    } else if (instr.type === 'step') {
      setStepText(directionToText(instr.direction));
      setDistance(String(instr.distance));
    } else if (instr.type === 'balance') {
      setBalanceText(directionToText(instr.direction));
      setDistance(String(instr.distance));
    }
  }

  function loadIntoForm(instr: Instruction) {
    if (instr.type === 'split') {
      setAction('split');
      setSplitBy(instr.by);
    } else {
      loadAtomicIntoForm(instr);
    }
  }

  function buildAtomicInstruction(id: number): AtomicInstruction {
    const base = { id, beats: Number(beats) || 0 };
    switch (action as ActionType) {
      case 'take_hands':
        return { id, beats: 0, type: 'take_hands', relationship, hand };
      case 'drop_hands':
        return { id, beats: 0, type: 'drop_hands', target: dropTarget };
      case 'allemande':
        return { ...base, type: 'allemande', relationship, handedness, rotations: Number(rotations) || 1 };
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
    }
  }

  function buildInstruction(id: number): Instruction {
    if (action === 'split') {
      return { id, type: 'split', by: splitBy, listA: [], listB: [] };
    }
    return buildAtomicInstruction(id);
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
      }
    } else {
      // Top-level
      if (editingId !== null) {
        setInstructions(instructions.map(i => i.id === editingId ? buildInstruction(editingId) : i));
        setEditingId(null);
      } else {
        setInstructions([...instructions, buildInstruction(nextId++)]);
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

  function handleTopLevelDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = instructions.findIndex(i => i.id === active.id);
    const newIndex = instructions.findIndex(i => i.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setInstructions(arrayMove(instructions, oldIndex, newIndex));
    }
  }

  function handleSubDragEnd(splitId: number, list: 'A' | 'B', event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setInstructions(instructions.map(i => {
      if (i.type !== 'split' || i.id !== splitId) return i;
      const key = list === 'A' ? 'listA' : 'listB';
      const arr = i[key];
      const oldIndex = arr.findIndex(sub => sub.id === active.id);
      const newIndex = arr.findIndex(sub => sub.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        return { ...i, [key]: arrayMove(arr, oldIndex, newIndex) };
      }
      return i;
    }));
  }

  function enterSubContext(splitId: number, list: 'A' | 'B') {
    setContext({ level: 'sub', splitId, list });
    setEditingId(null);
    setAction('take_hands');
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const isSubContext = context.level === 'sub';
  const currentSplit = isSubContext
    ? instructions.find(i => i.type === 'split' && i.id === context.splitId) as Extract<Instruction, { type: 'split' }> | undefined
    : undefined;

  return (
    <div className="command-pane">
      <h2>Instructions</h2>

      {isSubContext && currentSplit && (
        <div className="builder-context">
          Adding to {splitGroupLabel(currentSplit.by, context.list)}
          <button className="back-btn" onClick={() => { setContext({ level: 'top' }); setEditingId(null); }}>Back</button>
        </div>
      )}

      <div className="instruction-builder">
        <label>
          Action
          <select value={action} onChange={e => {
            const a = e.target.value as ActionType | 'split';
            setAction(a);
            if (editingId === null) setBeats(defaultBeats(a));
          }}>
            <option value="take_hands">take hands</option>
            <option value="drop_hands">drop hands</option>
            <option value="allemande">allemande</option>
            <option value="turn">turn</option>
            <option value="step">step</option>
            <option value="balance">balance</option>
            {!isSubContext && <option value="split">split</option>}
          </select>
        </label>

        {action === 'split' && (
          <label>
            Split by
            <select value={splitBy} onChange={e => setSplitBy(e.target.value as SplitBy)}>
              <option value="role">role (larks / robins)</option>
              <option value="position">position (ups / downs)</option>
            </select>
          </label>
        )}

        {action !== 'split' && (action === 'take_hands' || action === 'allemande') && (
          <label>
            With
            <select value={relationship} onChange={e => setRelationship(e.target.value as Relationship)}>
              <option value="partner">partner</option>
              <option value="neighbor">neighbor</option>
              <option value="opposite">opposite</option>
              <option value="on_right">on your right</option>
              <option value="on_left">on your left</option>
              <option value="in_front">in front of you</option>
            </select>
          </label>
        )}

        {action === 'drop_hands' && (
          <label>
            Drop
            <select value={dropTarget} onChange={e => setDropTarget(e.target.value as DropHandsTarget)}>
              <option value="partner">partner hands</option>
              <option value="neighbor">neighbor hands</option>
              <option value="opposite">opposite hands</option>
              <option value="on_right">on-your-right hands</option>
              <option value="on_left">on-your-left hands</option>
              <option value="in_front">in-front hands</option>
              <option value="right">right hand</option>
              <option value="left">left hand</option>
              <option value="both">both hands</option>
            </select>
          </label>
        )}

        {action === 'take_hands' && (
          <label>
            Hand
            <select value={hand} onChange={e => setHand(e.target.value as 'left' | 'right')}>
              <option value="right">right</option>
              <option value="left">left</option>
            </select>
          </label>
        )}

        {action === 'allemande' && (
          <>
            <label>
              Hand
              <select value={handedness} onChange={e => setHandedness(e.target.value as 'left' | 'right')}>
                <option value="right">right</option>
                <option value="left">left</option>
              </select>
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

      <div className="instruction-list">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopLevelDragEnd}>
          <SortableContext items={instructions.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {instructions.map(instr => (
              <SortableItem key={instr.id} id={instr.id}>
                {(dragHandleProps) => (
                  <>
                    <div className={`instruction-item${editingId === instr.id && context.level === 'top' ? ' editing' : ''}`}>
                      <span className="drag-handle" {...dragHandleProps}>{'\u2630'}</span>
                      <span className="instruction-summary">{summarize(instr)}</span>
                      <div className="instruction-actions">
                        <button onClick={() => startEdit(instr)} title="Edit">{'\u270E'}</button>
                        <button onClick={() => remove(instr.id)} title="Delete">{'\u00D7'}</button>
                      </div>
                    </div>
                    {instr.type === 'split' && renderSplitBody(instr)}
                  </>
                )}
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        {instructions.length === 0 && (
          <div className="instruction-empty">No instructions yet. Add one above.</div>
        )}
      </div>
    </div>
  );

  function renderSplitBody(split: Extract<Instruction, { type: 'split' }>) {
    return (
      <div className="split-body">
        {(['A', 'B'] as const).map(list => {
          const subList = list === 'A' ? split.listA : split.listB;
          const label = splitGroupLabel(split.by, list);
          return (
            <div key={list} className="split-group">
              <div className="split-group-header">{label}:</div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleSubDragEnd(split.id, list, e)}>
                <SortableContext items={subList.map(s => s.id)} strategy={verticalListSortingStrategy}>
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
              </DndContext>
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
