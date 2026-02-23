import { InstructionSchema, FoilBaseRelationshipSchema } from '../../types';
import type { AtomicInstruction } from '../../types';
import { z } from 'zod';
import type { SubFormProps } from '../../fieldUtils';
import { FOIL_RELATIONSHIP_OPTIONS, RELATIONSHIP_LABELS } from '../../fieldUtils';
import { InlineDropdown } from '../../InlineDropdown';
import { InlineNumber } from '../../InlineNumber';

const MAD_ROBIN_DIR_OPTIONS = ['larks_in_middle', 'robins_in_middle'];
const MAD_ROBIN_DIR_LABELS: Record<string, string> = { larks_in_middle: 'larks in middle', robins_in_middle: 'robins in middle' };
const MAD_ROBIN_WITH_OPTIONS = ['larks_left', 'robins_left'];
const MAD_ROBIN_WITH_LABELS: Record<string, string> = { larks_left: "larks' left", robins_left: "robins' left" };

export function MadRobinFields({ instruction, onChange, onInvalid }: SubFormProps & { instruction: Extract<AtomicInstruction, { type: 'mad_robin' }> }) {
  const { id } = instruction;

  function tryCommit(overrides: Record<string, unknown>) {
    const raw = { id, type: 'mad_robin', beats: instruction.beats, relationship: instruction.relationship, dir: instruction.dir, with: instruction.with, rotations: instruction.rotations, ...overrides };
    const result = InstructionSchema.safeParse(raw);
    if (result.success) onChange(result.data);
    else onInvalid?.();
  }

  return (<>
    {'your '}
    <InlineDropdown options={FOIL_RELATIONSHIP_OPTIONS} value={instruction.relationship.base} onChange={v => tryCommit({ relationship: { base: FoilBaseRelationshipSchema.parse(v), offset: instruction.relationship.offset } })} getLabel={v => RELATIONSHIP_LABELS[v] ?? v} />
    {' '}
    <InlineDropdown options={MAD_ROBIN_DIR_OPTIONS} value={instruction.dir} onChange={v => tryCommit({ dir: z.enum(['larks_in_middle', 'robins_in_middle']).parse(v) })} getLabel={v => MAD_ROBIN_DIR_LABELS[v] ?? v} />
    {' '}
    <InlineDropdown options={MAD_ROBIN_WITH_OPTIONS} value={instruction.with} onChange={v => tryCommit({ with: z.enum(['larks_left', 'robins_left']).parse(v) })} getLabel={v => MAD_ROBIN_WITH_LABELS[v] ?? v} />
    {' '}
    <InlineNumber value={String(instruction.rotations)} onTextChange={v => tryCommit({ rotations: Number(v) })} onDrag={n => tryCommit({ rotations: n })} step={0.25} suffix="x" />
  </>);
}
