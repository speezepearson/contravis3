import { createContext, useContext } from 'react';
import type { ProtoDancerId, DancerState } from './types';

export const InstructionEditContext = createContext<{
  onPopoverOpen?: () => void;
  dancerStates?: Record<ProtoDancerId, DancerState>;
}>({});

export function useInstructionEdit() {
  return useContext(InstructionEditContext);
}
