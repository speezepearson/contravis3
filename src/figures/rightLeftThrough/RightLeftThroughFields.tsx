import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RightLeftThroughFields(_props: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'right_left_through' }> }) {
  return null;
}
