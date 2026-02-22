import { InstructionSchema, RelationshipSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, DIR_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

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
    <InlineDropdown options={RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={v => tryCommit({ relationship: RelationshipSchema.parse(v) })} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    {' \u2192 '}
    <InlineDropdown options={DIR_OPTIONS} value={directionToText(instruction.endFacing)} onChange={v => { const f = parseDirection(v); if (f) tryCommit({ endFacing: f }); else onInvalid?.(); }} placeholder="e.g. across" />
  </>);
}
