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
