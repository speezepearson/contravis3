import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CourtesyTurnFields(_props: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'courtesy_turn' }> }) {
  return null;
}
