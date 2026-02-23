import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SquareThroughFields(_props: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'square_through' }> }) {
  return null;
}
