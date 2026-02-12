import type { Keyframe } from './types';

// Improper formation: hands-four centered at y=0.
// Down dancers at y=+0.5 facing south, up dancers at y=-0.5 facing north.
// Larks on the left of their pair (west when facing north, east when facing south).
const improperDancers = () => ({
  up_lark:    { x: -0.5, y: -0.5, facing: 0 },
  up_robin:   { x:  0.5, y: -0.5, facing: 0 },
  down_lark:  { x:  0.5, y:  0.5, facing: 180 },
  down_robin: { x: -0.5, y:  0.5, facing: 180 },
});

export const KEYFRAMES: Keyframe[] = [
  { beat: 0,  dancers: improperDancers(), hands: [] },
  { beat: 64, dancers: improperDancers(), hands: [] },
];

// Camera pans south at 1 meter per 64 beats
export const PROGRESSION_RATE = -1 / 64;
