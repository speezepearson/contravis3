import { InstructionSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import { z } from 'zod';
import type { SubFormProps } from '../../fieldUtils';
import { FULL_FOIL_RELATIONSHIP_OPTIONS, HAND_OPTIONS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { RelationshipDropdown } from '../../RelationshipDropdown';

const END_FACING_OPTIONS = ['larks_up_robins_down', 'larks_down_robins_up', 'larks_across_robins_out', 'larks_out_robins_across'];
const END_FACING_LABELS: Record<string, string> = {
  larks_up_robins_down: 'larks up, robins down',
  larks_down_robins_up: 'larks down, robins up',
  larks_across_robins_out: 'larks across, robins out',
  larks_out_robins_across: 'larks out, robins across',
};

export function ShoulderRoundFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'shoulder_round' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'shoulder_round', beats: instruction.beats, relationship: instruction.relationship, handedness: instruction.handedness, endFacing: instruction.endFacing, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    <InlineDropdown options={HAND_OPTIONS} value={instruction.handedness} onChange={v => tryCommit({ handedness: z.enum(['right', 'left']).parse(v) })} getLabel={v => v} />
    {' your '}
    <RelationshipDropdown options={FULL_FOIL_RELATIONSHIP_OPTIONS} value={instruction.relationship} onChange={rel => tryCommit({ relationship: rel })} />
    {', end facing '}
    <InlineDropdown options={END_FACING_OPTIONS} value={instruction.endFacing} onChange={v => tryCommit({ endFacing: v })} getLabel={v => END_FACING_LABELS[v] ?? v} />
  </>);
}
