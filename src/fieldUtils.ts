import { InstructionSchema, InstructionIdSchema, RelativeDirectionSchema, BaseRelationshipSchema } from './types';
import type { Instruction, RelativeDirection, Role, InstructionId, ActionType, BaseRelationship, FoilBaseRelationship } from './types';
import { assertNever } from './utils';

// --- Shared sub-form types ---

/** Props for inline field components. Each component receives `onChange` for immediate
 *  commit of valid instructions, and `onInvalid` to signal when validation fails. */
export interface SubFormProps {
  onChange: (instr: Instruction) => void;
  onInvalid?: () => void;
}

/** Create a default instruction for a given type. Used when adding new instructions
 *  or when the user changes the action type dropdown. */
export function makeDefaultInstruction(type: ActionType | 'split', id: InstructionId): Instruction {
  switch (type) {
    case 'step':
      return InstructionSchema.parse({ id, type: 'step', beats: 0, direction: { kind: 'direction', value: 'forward' }, distance: 0, facing: { kind: 'direction', value: 'forward' }, facingOffset: 0 });
    case 'take_hands':
      return InstructionSchema.parse({ id, type: 'take_hands', beats: 0, relationship: { base: 'neighbor', offset: 0 }, hand: 'right' });
    case 'drop_hands':
      return InstructionSchema.parse({ id, type: 'drop_hands', beats: 0, target: 'both' });
    case 'allemande':
      return InstructionSchema.parse({ id, type: 'allemande', beats: 8, relationship: { base: 'neighbor', offset: 0 }, handedness: 'right', rotations: 1 });
    case 'do_si_do':
      return InstructionSchema.parse({ id, type: 'do_si_do', beats: 8, relationship: { base: 'neighbor', offset: 0 }, rotations: 1 });
    case 'circle':
      return InstructionSchema.parse({ id, type: 'circle', beats: 8, direction: 'left', rotations: 1 });
    case 'pull_by':
      return InstructionSchema.parse({ id, type: 'pull_by', beats: 2, relationship: { base: 'neighbor', offset: 0 }, hand: 'right' });
    case 'pass_by':
      return InstructionSchema.parse({ id, type: 'pass_by', beats: 2, relationship: { base: 'neighbor', offset: 0 }, hand: 'right' });
    case 'balance':
      return InstructionSchema.parse({ id, type: 'balance', beats: 4, direction: { kind: 'direction', value: 'across' }, distance: 0.5 });
    case 'swing':
      return InstructionSchema.parse({ id, type: 'swing', beats: 8, relationship: { base: 'neighbor', offset: 0 }, endFacing: { kind: 'direction', value: 'across' } });
    case 'box_the_gnat':
      return InstructionSchema.parse({ id, type: 'box_the_gnat', beats: 4, relationship: { base: 'neighbor', offset: 0 } });
    case 'give_and_take_into_swing':
      return InstructionSchema.parse({ id, type: 'give_and_take_into_swing', beats: 16, relationship: { base: 'neighbor', offset: 0 }, role: 'lark', endFacing: { kind: 'direction', value: 'across' } });
    case 'mad_robin':
      return InstructionSchema.parse({ id, type: 'mad_robin', beats: 8, relationship: { base: 'neighbor', offset: 0 }, dir: 'larks_in_middle', rotations: 1 });
    case 'short_waves':
      return InstructionSchema.parse({ id, type: 'short_waves', beats: 0 });
    case 'long_waves':
      return InstructionSchema.parse({ id, type: 'long_waves', beats: 0 });
    case 'long_lines':
      return InstructionSchema.parse({ id, type: 'long_lines', beats: 8 });
    case 'split':
      return InstructionSchema.parse({ id, type: 'split', by: 'role', larks: [], robins: [] });
    default:
      return assertNever(type);
  }
}

export function makeInstructionId(): InstructionId {
  return InstructionIdSchema.parse(crypto.randomUUID());
}

export function parseDirection(text: string): RelativeDirection | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  const asDir = RelativeDirectionSchema.safeParse({ kind: 'direction', value: trimmed });
  if (asDir.success) return asDir.data;
  // Try parsing as a base relationship name with offset 0
  const asRel = RelativeDirectionSchema.safeParse({ kind: 'relationship', value: { base: trimmed, offset: 0 } });
  if (asRel.success) return asRel.data;
  return null;
}

export function directionToText(dir: RelativeDirection): string {
  if (dir.kind === 'direction') return dir.value;
  return dir.value.base;
}

// --- Option constants ---

export const DIR_OPTIONS = ['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left', 'partner', 'neighbor', 'opposite'];

export const RELATIONSHIP_OPTIONS: BaseRelationship[] = ['partner', 'neighbor', 'opposite'];
export const FOIL_RELATIONSHIP_OPTIONS: FoilBaseRelationship[] = ['partner', 'neighbor'];
export const RELATIONSHIP_LABELS: Record<string, string> = {
  partner: 'partner', neighbor: 'neighbor', opposite: 'opposite',
};

/** Convert a BaseRelationship string to a Relationship object (offset 0). */
export function parseBaseRelationship(base: string): { base: BaseRelationship; offset: number } {
  return { base: BaseRelationshipSchema.parse(base), offset: 0 };
}

// --- Relationship encoding for the relationship dropdown ---

/** Encode a relationship as "base:offset" for use as a dropdown option key. */
export function encodeRelationship(rel: { base: string; offset: number }): string {
  return `${rel.base}:${rel.offset}`;
}

/** Decode a "base:offset" string back to a relationship object. */
export function decodeRelationship(encoded: string): { base: string; offset: number } {
  const i = encoded.lastIndexOf(':');
  return { base: encoded.slice(0, i), offset: parseInt(encoded.slice(i + 1)) };
}

/** Human-readable label for a relationship: "partner", "next neighbor", "shadow +2", etc. */
export function relationshipLabel(rel: { base: string; offset: number }): string {
  if (rel.base === 'partner' && rel.offset === 0) return 'partner';
  if (rel.base === 'partner') return `shadow ${rel.offset > 0 ? '+' : ''}${rel.offset}`;
  if (rel.offset === 0) return rel.base;
  if (rel.offset === 1) return `next ${rel.base}`;
  if (rel.offset === -1) return `prev ${rel.base}`;
  return rel.offset > 0 ? `next x${rel.offset} ${rel.base}` : `prev x${Math.abs(rel.offset)} ${rel.base}`;
}

/** Label function for encoded relationship option keys. */
export function relationshipOptionLabel(encoded: string): string {
  return relationshipLabel(decodeRelationship(encoded));
}

function buildRelationshipOptions(bases: string[]): string[] {
  const options: string[] = [];
  for (const base of bases) {
    options.push(`${base}:0`);
    if (base !== 'partner') {
      for (let i = 1; i <= 4; i++) {
        options.push(`${base}:${i}`, `${base}:${-i}`);
      }
    }
  }
  // shadow (partner with non-zero offset)
  for (let i = 1; i <= 4; i++) {
    options.push(`partner:${i}`, `partner:${-i}`);
  }
  return options;
}

/** All relationship options including opposite, for figures using Relationship. */
export const FULL_RELATIONSHIP_OPTIONS = buildRelationshipOptions(['partner', 'neighbor', 'opposite']);
/** Relationship options without opposite, for figures using FoilRelationship. */
export const FULL_FOIL_RELATIONSHIP_OPTIONS = buildRelationshipOptions(['partner', 'neighbor']);

export const DROP_TARGET_OPTIONS: string[] = ['partner', 'neighbor', 'opposite', 'right', 'left', 'both'];
export const DROP_TARGET_LABELS: Record<string, string> = {
  partner: 'partner hands', neighbor: 'neighbor hands', opposite: 'opposite hands',
  right: 'right hand', left: 'left hand', both: 'both hands',
};

export const HAND_OPTIONS = ['right', 'left'];
export const TAKE_HAND_OPTIONS = ['right', 'left', 'both', 'inside'];
export const CIRCLE_DIR_OPTIONS = ['left', 'right'];

export const ROLE_OPTIONS: Role[] = ['lark', 'robin'];

export const SPLIT_BY_OPTIONS = ['role', 'position'];
export const SPLIT_BY_LABELS: Record<string, string> = {
  role: 'role (larks / robins)', position: 'position (ups / downs)',
};
