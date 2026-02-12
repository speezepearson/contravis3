import { useState } from 'react';
import type { Instruction, Selector, Relationship, FaceTarget } from './types';

type ActionType = Instruction['type'];

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
    case 'face': {
      const t = instr.target;
      const desc = t.kind === 'direction' ? t.value
        : t.kind === 'degrees' ? `${t.value}°`
        : t.value;
      return `${sel}face ${desc} (${instr.beats}b)`;
    }
  }
}

export default function CommandPane({ instructions, setInstructions }: Props) {
  const [selector, setSelector] = useState<Selector>('everyone');
  const [action, setAction] = useState<ActionType>('take_hands');
  const [relationship, setRelationship] = useState<Relationship>('neighbor');
  const [hand, setHand] = useState<'left' | 'right'>('right');
  const [direction, setDirection] = useState<'cw' | 'ccw'>('cw');
  const [rotations, setRotations] = useState(1);
  const [faceKind, setFaceKind] = useState<FaceTarget['kind']>('direction');
  const [faceDirection, setFaceDirection] = useState<'up' | 'down' | 'across' | 'out'>('up');
  const [faceDegrees, setFaceDegrees] = useState(0);
  const [faceRelationship, setFaceRelationship] = useState<Relationship>('partner');
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
    } else if (instr.type === 'face') {
      setFaceKind(instr.target.kind);
      if (instr.target.kind === 'direction') setFaceDirection(instr.target.value);
      else if (instr.target.kind === 'degrees') setFaceDegrees(instr.target.value);
      else setFaceRelationship(instr.target.value);
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
      case 'face': {
        let target: FaceTarget;
        if (faceKind === 'direction') target = { kind: 'direction', value: faceDirection };
        else if (faceKind === 'degrees') target = { kind: 'degrees', value: faceDegrees };
        else target = { kind: 'relationship', value: faceRelationship };
        return { ...base, type: 'face', target };
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
            <option value="face">face</option>
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

        {action === 'face' && (
          <>
            <label>
              Target
              <select value={faceKind} onChange={e => setFaceKind(e.target.value as FaceTarget['kind'])}>
                <option value="direction">direction</option>
                <option value="degrees">degrees</option>
                <option value="relationship">relationship</option>
              </select>
            </label>
            {faceKind === 'direction' && (
              <label>
                Direction
                <select value={faceDirection} onChange={e => setFaceDirection(e.target.value as 'up' | 'down' | 'across' | 'out')}>
                  <option value="up">up</option>
                  <option value="down">down</option>
                  <option value="across">across</option>
                  <option value="out">out</option>
                </select>
              </label>
            )}
            {faceKind === 'degrees' && (
              <label>
                Degrees
                <input
                  type="number"
                  value={faceDegrees}
                  onChange={e => setFaceDegrees(Number(e.target.value))}
                />
              </label>
            )}
            {faceKind === 'relationship' && (
              <label>
                Toward
                <select value={faceRelationship} onChange={e => setFaceRelationship(e.target.value as Relationship)}>
                  <option value="partner">partner</option>
                  <option value="neighbor">neighbor</option>
                  <option value="opposite">opposite</option>
                </select>
              </label>
            )}
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
