import { InstructionSchema, RelationshipSchema, RoleSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { parseDirection, directionToText, RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS, DIR_OPTIONS, ROLE_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';

export function GiveAndTakeIntoSwingFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'give_and_take_into_swing' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'give_and_take_into_swing', beats: instruction.beats, relationship: instruction.relationship, role: instruction.role, endFacing: instruction.endFacing, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={ROLE_OPTIONS} value={instruction.role} onChange={v => tryCommit({ role: RoleSchema.parse(v) })} getLabel={v => v + 's give'} />
    {' \u2192 '}
    <InlineDropdown options={RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={v => tryCommit({ relationship: RelationshipSchema.parse(v) })} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    {' \u2192 '}
    <InlineDropdown options={DIR_OPTIONS} value={directionToText(instruction.endFacing)} onChange={v => { const f = parseDirection(v); if (f) tryCommit({ endFacing: f }); else onInvalid?.(); }} placeholder="e.g. across" />
  </>);
}
