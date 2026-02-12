import { useState, useRef } from 'react';
import type { Instruction, Selector, Relationship, RelativeDirection } from './types';

type ActionType = Instruction['type'];

const DIR_COMPLETIONS = ['up', 'down', 'across', 'out', 'progression', 'anti-progression', 'partner', 'neighbor', 'opposite'];

function parseDirection(text: string): RelativeDirection | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  const directions = new Set(['up', 'down', 'across', 'out', 'progression', 'anti-progression']);
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

let nextId = 1;

interface Props {
  instructions: Instruction[];
  setInstructions: (instructions: Instruction[]) => void;
}

function summarize(instr: Instruction): string {
  const sel = instr.selector === 'everyone' ? '' : `${instr.selector}: `;
  switch (instr.type) {
    case 'take_hands':
      return `${sel}${instr.relationship}s take ${instr.hand} hands (${instr.beats}b)`;
    case 'drop_hands':
      return `${sel}drop ${instr.relationship} hands (${instr.beats}b)`;
    case 'allemande':
      return `${sel}${instr.relationship} allemande ${instr.direction} ${instr.rotations}x (${instr.beats}b)`;
    case 'turn': {
      const t = instr.target;
      const desc = t.kind === 'direction' ? t.value
        : t.kind === 'cw' ? `${t.value}°`
        : t.value;
      return `${sel}turn ${desc} (${instr.beats}b)`;
    }
    case 'step': {
      const t = instr.direction;
      const desc = t.kind === 'direction' ? t.value
        : t.kind === 'cw' ? `${t.value}°`
        : t.value;
      return `${sel}step ${desc} ${instr.distance} (${instr.beats}b)`;
    }
  }
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
  const [selector, setSelector] = useState<Selector>('everyone');
  const [action, setAction] = useState<ActionType>('take_hands');
  const [relationship, setRelationship] = useState<Relationship>('neighbor');
  const [hand, setHand] = useState<'left' | 'right'>('right');
  const [direction, setDirection] = useState<'cw' | 'ccw'>('cw');
  const [rotations, setRotations] = useState(1);
  const [turnText, setTurnText] = useState('');
  const [turnCompletion, setTurnCompletion] = useState('');
  const turnInputRef = useRef<HTMLInputElement>(null);
  const [stepText, setStepText] = useState('');
  const [stepCompletion, setStepCompletion] = useState('');
  const stepInputRef = useRef<HTMLInputElement>(null);
  const [distance, setDistance] = useState(0.5);
  const [beats, setBeats] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);

  function loadIntoForm(instr: Instruction) {
    setSelector(instr.selector);
    setAction(instr.type);
    setBeats(instr.beats);
    if (instr.type === 'take_hands') {
      setRelationship(instr.relationship);
      setHand(instr.hand);
    } else if (instr.type === 'drop_hands') {
      setRelationship(instr.relationship);
    } else if (instr.type === 'allemande') {
      setRelationship(instr.relationship);
      setDirection(instr.direction);
      setRotations(instr.rotations);
    } else if (instr.type === 'turn') {
      setTurnText(directionToText(instr.target));
      setTurnCompletion('');
    } else if (instr.type === 'step') {
      setStepText(directionToText(instr.direction));
      setStepCompletion('');
      setDistance(instr.distance);
    }
  }

  function buildInstruction(id: number): Instruction {
    const base = { id, selector, beats };
    switch (action) {
      case 'take_hands':
        return { ...base, type: 'take_hands', relationship, hand };
      case 'drop_hands':
        return { ...base, type: 'drop_hands', relationship };
      case 'allemande':
        return { ...base, type: 'allemande', relationship, direction, rotations };
      case 'turn': {
        const target = parseDirection(turnText) ?? { kind: 'direction' as const, value: 'up' as const };
        return { ...base, type: 'turn', target };
      }
      case 'step': {
        const dir = parseDirection(stepText) ?? { kind: 'direction' as const, value: 'up' as const };
        return { ...base, type: 'step', direction: dir, distance };
      }
    }
  }

  function add() {
    if (editingId !== null) {
      setInstructions(instructions.map(i => i.id === editingId ? buildInstruction(editingId) : i));
      setEditingId(null);
    } else {
      setInstructions([...instructions, buildInstruction(nextId++)]);
    }
  }

  function startEdit(instr: Instruction) {
    loadIntoForm(instr);
    setEditingId(instr.id);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function remove(id: number) {
    setInstructions(instructions.filter(i => i.id !== id));
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

  return (
    <div className="command-pane">
      <h2>Instructions</h2>
      <div className="instruction-builder">
        <label>
          Who
          <select value={selector} onChange={e => setSelector(e.target.value as Selector)}>
            <option value="everyone">everyone</option>
            <option value="larks">larks</option>
            <option value="robins">robins</option>
            <option value="ups">ups</option>
            <option value="downs">downs</option>
          </select>
        </label>

        <label>
          Action
          <select value={action} onChange={e => setAction(e.target.value as ActionType)}>
            <option value="take_hands">take hands</option>
            <option value="drop_hands">drop hands</option>
            <option value="allemande">allemande</option>
            <option value="turn">turn</option>
            <option value="step">step</option>
          </select>
        </label>

        {(action === 'take_hands' || action === 'drop_hands' || action === 'allemande') && (
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
              Direction
              <select value={direction} onChange={e => setDirection(e.target.value as 'cw' | 'ccw')}>
                <option value="cw">clockwise</option>
                <option value="ccw">counter-cw</option>
              </select>
            </label>
            <label>
              Rotations
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={rotations}
                onChange={e => setRotations(Number(e.target.value))}
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
                type="number"
                min={0}
                step={0.25}
                value={distance}
                onChange={e => setDistance(Number(e.target.value))}
              />
            </label>
          </>
        )}

        <label>
          Beats
          <input
            type="number"
            min={0}
            step={1}
            value={beats}
            onChange={e => setBeats(Number(e.target.value))}
          />
        </label>

        <div className="builder-buttons">
          <button className="add-btn" onClick={add}>{editingId !== null ? 'Save' : 'Add'}</button>
          {editingId !== null && <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>}
        </div>
      </div>

      <div className="instruction-list">
        {instructions.map((instr, idx) => (
          <div key={instr.id} className={`instruction-item${editingId === instr.id ? ' editing' : ''}`}>
            <span className="instruction-summary">{summarize(instr)}</span>
            <div className="instruction-actions">
              <button onClick={() => startEdit(instr)} title="Edit">{'\u270E'}</button>
              <button onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">{'\u25B2'}</button>
              <button onClick={() => moveDown(idx)} disabled={idx === instructions.length - 1} title="Move down">{'\u25BC'}</button>
              <button onClick={() => remove(instr.id)} title="Delete">{'\u00D7'}</button>
            </div>
          </div>
        ))}
        {instructions.length === 0 && (
          <div className="instruction-empty">No instructions yet. Add one above.</div>
        )}
      </div>
    </div>
  );
}
