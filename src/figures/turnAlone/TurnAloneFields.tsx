import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TurnAloneFields(_props: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'turn_alone' }> }) {
  return null;
}
