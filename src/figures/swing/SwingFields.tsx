import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, FULL_FOIL_RELATIONSHIP_OPTIONS, DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { RelationshipDropdown } from '../../RelationshipDropdown';

export function SwingFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'swing' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'swing', beats: instruction.beats, relationship: instruction.relationship, endFacing: instruction.endFacing, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'your '}
    <RelationshipDropdown options={FULL_FOIL_RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={rel => tryCommit({ relationship: rel })} />
    {' \u2192 '}
    <InlineDropdown options={DIR_OPTIONS} value={directionToText(instruction.endFacing)} onChange={v => { const f = parseDirection(v); if (f) tryCommit({ endFacing: f }); }} placeholder="e.g. across" />
  </>);
}
