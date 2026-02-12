// Which dancers perform the action (others hold still)
export type Selector = 'everyone' | 'larks' | 'robins' | 'ups' | 'downs';

// Who they interact with (only for actions that involve a partner)
export type Relationship = 'partner' | 'neighbor' | 'opposite';

// Direction relative to a dancer: a named direction, a relationship, or CW degrees
export type RelativeDirection =
  | { kind: 'direction'; value: 'up' | 'down' | 'across' | 'out' | 'progression' | 'anti-progression' }
  | { kind: 'cw'; value: number }         // clockwise degrees from current facing
  | { kind: 'relationship'; value: Relationship };

export type Instruction = {
  id: number;
  selector: Selector;
  beats: number;
} & (
  | { type: 'take_hands'; relationship: Relationship; hand: 'left' | 'right' }
  | { type: 'drop_hands'; relationship: Relationship }
  | { type: 'allemande'; relationship: Relationship; direction: 'cw' | 'ccw'; rotations: number }
  | { type: 'turn'; target: RelativeDirection }
  | { type: 'step'; direction: RelativeDirection; distance: number }
);

export interface DancerState {
  x: number;
  y: number;
  facing: number; // degrees: 0=north, 90=east, 180=south, 270=west
}

export interface HandConnection {
  a: string;
  ha: string; // 'left' | 'right'
  b: string;
  hb: string; // 'left' | 'right'
}

export interface Keyframe {
  beat: number;
  dancers: Record<string, DancerState>;
  hands: HandConnection[];
  annotation?: string;
}
