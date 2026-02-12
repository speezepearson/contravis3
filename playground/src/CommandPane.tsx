import { useState, useRef } from 'react';
import type { Instruction, AtomicInstruction, Relationship, RelativeDirection, SplitBy } from './types';

type ActionType = AtomicInstruction['type'];

const DIR_COMPLETIONS = ['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left', 'partner', 'neighbor', 'opposite'];

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
    case 'take_hands':
      return `${instr.relationship}s take ${instr.hand} hands (${instr.beats}b)`;
    case 'drop_hands':
      return `drop ${instr.relationship} hands (${instr.beats}b)`;
    case 'allemande':
      return `${instr.relationship} allemande ${instr.handedness} ${instr.rotations}x (${instr.beats}b)`;
    case 'turn': {
      const t = instr.target;
      const desc = t.kind === 'direction' ? t.value
        : t.kind === 'cw' ? `${t.value}\u00B0`
        : t.value;
      return `turn ${desc} (${instr.beats}b)`;
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

function DirectionInput({ value, completion, inputRef, onChange, onComplete }: {
  value: string;
  completion: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (val: string, completion: string) => void;
  onComplete: () => void;
}) {
  return (
    <div className="face-input-wrap">
      <input
        ref={inputRef}
        type="text"
        className="face-input"
        value={value}
        placeholder="e.g. across, neighbor, 45"
        onChange={e => {
          const val = e.target.value;
          const lower = val.trim().toLowerCase();
          const match = lower ? DIR_COMPLETIONS.find(c => c.startsWith(lower) && c !== lower) ?? '' : '';
          onChange(val, match);
        }}
        onKeyDown={e => {
          if (e.key === 'Tab' && completion) {
            e.preventDefault();
            onComplete();
          }
        }}
        onBlur={() => onChange(value, '')}
      />
      {completion && (
        <span className="face-ghost">{completion}</span>
      )}
    </div>
  );
}

export default function CommandPane({ instructions, setInstructions }: Props) {
  const [context, setContext] = useState<BuilderContext>({ level: 'top' });
  const [action, setAction] = useState<ActionType | 'split'>('take_hands');
  const [relationship, setRelationship] = useState<Relationship>('neighbor');
  const [hand, setHand] = useState<'left' | 'right'>('right');
  const [handedness, setHandedness] = useState<'left' | 'right'>('right');
  const [rotations, setRotations] = useState('1');
  const [turnText, setTurnText] = useState('');
  const [turnCompletion, setTurnCompletion] = useState('');
  const turnInputRef = useRef<HTMLInputElement>(null);
  const [stepText, setStepText] = useState('');
  const [stepCompletion, setStepCompletion] = useState('');
  const stepInputRef = useRef<HTMLInputElement>(null);
  const [balanceText, setBalanceText] = useState('');
  const [balanceCompletion, setBalanceCompletion] = useState('');
  const balanceInputRef = useRef<HTMLInputElement>(null);
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
      setRelationship(instr.relationship);
    } else if (instr.type === 'allemande') {
      setRelationship(instr.relationship);
      setHandedness(instr.handedness);
      setRotations(String(instr.rotations));
    } else if (instr.type === 'turn') {
      setTurnText(directionToText(instr.target));
      setTurnCompletion('');
    } else if (instr.type === 'step') {
      setStepText(directionToText(instr.direction));
      setStepCompletion('');
      setDistance(String(instr.distance));
    } else if (instr.type === 'balance') {
      setBalanceText(directionToText(instr.direction));
      setBalanceCompletion('');
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
        return { ...base, type: 'take_hands', relationship, hand };
      case 'drop_hands':
        return { ...base, type: 'drop_hands', relationship };
      case 'allemande':
        return { ...base, type: 'allemande', relationship, handedness, rotations: Number(rotations) || 1 };
      case 'turn': {
        const target = parseDirection(turnText) ?? { kind: 'direction' as const, value: 'up' as const };
        return { ...base, type: 'turn', target };
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

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...instructions];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setInstructions(next);
  }

  function moveDown(idx: number) {
    if (idx === instructions.length - 1) return;
    const next = [...instructions];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setInstructions(next);
  }

  function moveSubUp(splitId: number, list: 'A' | 'B', idx: number) {
    if (idx === 0) return;
    setInstructions(instructions.map(i => {
      if (i.type !== 'split' || i.id !== splitId) return i;
      const key = list === 'A' ? 'listA' : 'listB';
      const arr = [...i[key]];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return { ...i, [key]: arr };
    }));
  }

  function moveSubDown(splitId: number, list: 'A' | 'B', idx: number, length: number) {
    if (idx === length - 1) return;
    setInstructions(instructions.map(i => {
      if (i.type !== 'split' || i.id !== splitId) return i;
      const key = list === 'A' ? 'listA' : 'listB';
      const arr = [...i[key]];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return { ...i, [key]: arr };
    }));
  }

  function enterSubContext(splitId: number, list: 'A' | 'B') {
    setContext({ level: 'sub', splitId, list });
    setEditingId(null);
    setAction('take_hands');
  }

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

        {action !== 'split' && (action === 'take_hands' || action === 'drop_hands' || action === 'allemande') && (
          <label>
            With
            <select value={relationship} onChange={e => setRelationship(e.target.value as Relationship)}>
              <option value="partner">partner</option>
              <option value="neighbor">neighbor</option>
              <option value="opposite">opposite</option>
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
          <label>
            Target
            <DirectionInput
              value={turnText}
              completion={turnCompletion}
              inputRef={turnInputRef}
              onChange={(val, comp) => { setTurnText(val); setTurnCompletion(comp); }}
              onComplete={() => { setTurnText(turnCompletion); setTurnCompletion(''); }}
            />
          </label>
        )}

        {action === 'step' && (
          <>
            <label>
              Direction
              <DirectionInput
                value={stepText}
                completion={stepCompletion}
                inputRef={stepInputRef}
                onChange={(val, comp) => { setStepText(val); setStepCompletion(comp); }}
                onComplete={() => { setStepText(stepCompletion); setStepCompletion(''); }}
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
              <DirectionInput
                value={balanceText}
                completion={balanceCompletion}
                inputRef={balanceInputRef}
                onChange={(val, comp) => { setBalanceText(val); setBalanceCompletion(comp); }}
                onComplete={() => { setBalanceText(balanceCompletion); setBalanceCompletion(''); }}
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

        {action !== 'split' && (
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
        {instructions.map((instr, idx) => (
          <div key={instr.id}>
            <div className={`instruction-item${editingId === instr.id && context.level === 'top' ? ' editing' : ''}`}>
              <span className="instruction-summary">{summarize(instr)}</span>
              <div className="instruction-actions">
                <button onClick={() => startEdit(instr)} title="Edit">{'\u270E'}</button>
                <button onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">{'\u25B2'}</button>
                <button onClick={() => moveDown(idx)} disabled={idx === instructions.length - 1} title="Move down">{'\u25BC'}</button>
                <button onClick={() => remove(instr.id)} title="Delete">{'\u00D7'}</button>
              </div>
            </div>
            {instr.type === 'split' && renderSplitBody(instr)}
          </div>
        ))}
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
              {subList.map((sub, subIdx) => (
                <div
                  key={sub.id}
                  className={`instruction-item split-sub-item${editingId === sub.id ? ' editing' : ''}`}
                >
                  <span className="instruction-summary">{summarizeAtomic(sub)}</span>
                  <div className="instruction-actions">
                    <button onClick={() => startSubEdit(split.id, list, sub)} title="Edit">{'\u270E'}</button>
                    <button onClick={() => moveSubUp(split.id, list, subIdx)} disabled={subIdx === 0} title="Move up">{'\u25B2'}</button>
                    <button onClick={() => moveSubDown(split.id, list, subIdx, subList.length)} disabled={subIdx === subList.length - 1} title="Move down">{'\u25BC'}</button>
                    <button onClick={() => removeSub(split.id, list, sub.id)} title="Delete">{'\u00D7'}</button>
                  </div>
                </div>
              ))}
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
