import { InstructionSchema, HandSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_RELATIONSHIP_OPTIONS, encodeRelationship, decodeRelationship, relationshipOptionLabel, HAND_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

export function AllemandeFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'allemande' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'allemande', beats: instruction.beats, relationship: instruction.relationship, handedness: instruction.handedness, rotations: instruction.rotations, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={HAND_OPTIONS} value={instruction.handedness} onChange={v => tryCommit({ handedness: HandSchema.parse(v) })} getLabel={v => v} />
    {' '}
    <InlineNumber value={String(instruction.rotations)} onTextChange={v => tryCommit({ rotations: Number(v) })} onDrag={n => tryCommit({ rotations: n })} step={0.25} suffix="x" />
    {' with your '}
    <InlineDropdown options={FULL_RELATIONSHIP_OPTIONS} value={encodeRelationship(instruction.relationship)} onChange={v => tryCommit({ relationship: decodeRelationship(v) })} getLabel={relationshipOptionLabel} />
  </>);
}
