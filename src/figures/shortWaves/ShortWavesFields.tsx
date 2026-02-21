import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ShortWavesFields(_props: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'short_waves' }> }) {
  return null;
}
