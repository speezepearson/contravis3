import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LongLinesFields(_props: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'long_lines' }> }) {
  return null;
}
