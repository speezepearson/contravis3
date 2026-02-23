import { createContext, useContext } from 'react';

export const InstructionEditContext = createContext<{ onPopoverOpen?: () => void }>({});

export function useInstructionEdit() {
  return useContext(InstructionEditContext);
}
