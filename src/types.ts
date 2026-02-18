export type Role = 'lark' | 'robin';
export type ProtoDancerId = 'up_lark' | 'up_robin' | 'down_lark' | 'down_robin';
export type DancerId = `${ProtoDancerId}_${number}`;

export function parseDancerId(id: DancerId): { proto: ProtoDancerId; offset: number } {
  const i = id.lastIndexOf('_');
  return { proto: id.slice(0, i) as ProtoDancerId, offset: parseInt(id.slice(i + 1)) };
}

export function makeDancerId(proto: ProtoDancerId, offset: number): DancerId {
  return `${proto}_${offset}` as DancerId;
}

export function dancerPosition(id: DancerId, dancers: Record<ProtoDancerId, DancerState>): DancerState {
  const { proto, offset } = parseDancerId(id);
  const b = dancers[proto];
  return { x: b.x, y: b.y + offset * 2, facing: b.facing };
}

// Who they interact with (only for actions that involve a partner)
export type Relationship = 'partner' | 'neighbor' | 'opposite' | 'on_right' | 'on_left' | 'in_front';

// What to drop: a relationship (drops hand connections between those pairs),
// a specific hand ('left'|'right'), or 'both' (all hand connections).
export type DropHandsTarget = Relationship | 'left' | 'right' | 'both';

// Direction relative to a dancer: a named direction or a relationship
export type RelativeDirection =
  | { kind: 'direction'; value: 'up' | 'down' | 'across' | 'out' | 'progression' | 'forward' | 'back' | 'right' | 'left' }
  | { kind: 'relationship'; value: Relationship };

export type AtomicInstruction = {
  id: number;
  beats: number;
} & (
  | { type: 'take_hands'; relationship: Relationship; hand: 'left' | 'right' }
  | { type: 'drop_hands'; target: DropHandsTarget }
  | { type: 'allemande'; relationship: Relationship; handedness: 'left' | 'right'; rotations: number }
  | { type: 'do_si_do'; relationship: Relationship; rotations: number }
  | { type: 'circle'; direction: 'left' | 'right'; rotations: number }
  | { type: 'pull_by'; relationship: Relationship; hand: 'left' | 'right' }
  | { type: 'turn'; target: RelativeDirection; offset: number }
  | { type: 'step'; direction: RelativeDirection; distance: number }
  | { type: 'balance'; direction: RelativeDirection; distance: number }
  | { type: 'swing'; relationship: Relationship; endFacing: RelativeDirection }
);

export type SplitBy = 'role' | 'position';

export type Instruction =
  | AtomicInstruction
  | { id: number; type: 'split'; by: SplitBy; listA: AtomicInstruction[]; listB: AtomicInstruction[] }
  | { id: number; type: 'group'; label: string; instructions: Instruction[] };

export interface DancerState {
  x: number;
  y: number;
  facing: number; // degrees: 0=north, 90=east, 180=south, 270=west
}

export interface HandConnection {
  a: DancerId;
  ha: 'left' | 'right';
  b: DancerId;
  hb: 'left' | 'right';
}

export interface Keyframe {
  beat: number;
  dancers: Record<ProtoDancerId, DancerState>;
  hands: HandConnection[];
  annotation?: string;
}
