import { z } from 'zod';

export const RoleSchema = z.enum(['lark', 'robin']);
export type Role = z.infer<typeof RoleSchema>;

export const ProgressionDirSchema = z.enum(['up', 'down']);
export type ProgressionDir = z.infer<typeof ProgressionDirSchema>;

export const ProtoDancerIdSchema = z.enum(['up_lark', 'up_robin', 'down_lark', 'down_robin']);
export type ProtoDancerId = z.infer<typeof ProtoDancerIdSchema>;

export const DancerIdSchema = z.templateLiteral([ProgressionDirSchema, '_', RoleSchema, '_', z.number().int()]);
export type DancerId = z.infer<typeof DancerIdSchema>;

export function parseDancerId(id: DancerId): { proto: ProtoDancerId; offset: number } {
  const i = id.lastIndexOf('_');
  return { proto: ProtoDancerIdSchema.parse(id.slice(0, i)), offset: parseInt(id.slice(i + 1)) };
}

export function makeDancerId(proto: ProtoDancerId, offset: number): DancerId {
  return DancerIdSchema.parse(`${proto}_${offset}`);
}

export function dancerPosition(id: DancerId, dancers: Record<ProtoDancerId, DancerState>): DancerState {
  const { proto, offset } = parseDancerId(id);
  const b = dancers[proto];
  return { x: b.x, y: b.y + offset * 2, facing: b.facing };
}

// Who they interact with (only for actions that involve a partner)
export const RelationshipSchema = z.enum(['partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front']);
export type Relationship = z.infer<typeof RelationshipSchema>;

// What to drop: a relationship (drops hand connections between those pairs),
// a specific hand ('left'|'right'), or 'both' (all hand connections).
export const DropHandsTargetSchema = z.union([RelationshipSchema, z.enum(['left', 'right', 'both'])]);
export type DropHandsTarget = z.infer<typeof DropHandsTargetSchema>;

export const HandSchema = z.enum(['left', 'right']);

// Direction relative to a dancer: a named direction or a relationship
export const RelativeDirectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('direction'), value: z.enum(['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left']) }),
  z.object({ kind: z.literal('relationship'), value: RelationshipSchema }),
]);
export type RelativeDirection = z.infer<typeof RelativeDirectionSchema>;

const baseFields = { id: z.number(), beats: z.number() };

export const AtomicInstructionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseFields, type: z.literal('take_hands'), relationship: RelationshipSchema, hand: HandSchema }),
  z.object({ ...baseFields, type: z.literal('drop_hands'), target: DropHandsTargetSchema }),
  z.object({ ...baseFields, type: z.literal('allemande'), relationship: RelationshipSchema, handedness: HandSchema, rotations: z.number() }),
  z.object({ ...baseFields, type: z.literal('do_si_do'), relationship: RelationshipSchema, rotations: z.number() }),
  z.object({ ...baseFields, type: z.literal('circle'), direction: HandSchema, rotations: z.number() }),
  z.object({ ...baseFields, type: z.literal('pull_by'), relationship: RelationshipSchema, hand: HandSchema }),
  z.object({ ...baseFields, type: z.literal('turn'), target: RelativeDirectionSchema, offset: z.number() }),
  z.object({ ...baseFields, type: z.literal('step'), direction: RelativeDirectionSchema, distance: z.number() }),
  z.object({ ...baseFields, type: z.literal('balance'), direction: RelativeDirectionSchema, distance: z.number() }),
  z.object({ ...baseFields, type: z.literal('swing'), relationship: RelationshipSchema, endFacing: RelativeDirectionSchema }),
]);
export type AtomicInstruction = z.infer<typeof AtomicInstructionSchema>;

export const ActionTypeSchema = z.enum(['take_hands', 'drop_hands', 'allemande', 'do_si_do', 'circle', 'pull_by', 'turn', 'step', 'balance', 'swing']);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const SplitBySchema = z.enum(['role', 'position']);
export type SplitBy = z.infer<typeof SplitBySchema>;

// Instruction is recursive (group contains Instruction[]), so we define the
// type manually with the brand baked in and annotate the schema accordingly.
export type Instruction = (
  | AtomicInstruction
  | { id: number; type: 'split'; by: SplitBy; listA: AtomicInstruction[]; listB: AtomicInstruction[] }
  | { id: number; type: 'group'; label: string; instructions: Instruction[] }
) & z.BRAND<'Instruction'>;

// The `as unknown as` double-cast bridges the gap between the unbranded
// schema output and our branded Instruction type.  At runtime z.lazy
// validates the full recursive structure; the cast only affects the
// compile-time type so that parse() returns branded Instructions.
export const InstructionSchema: z.ZodType<Instruction> = z.lazy(() => z.union([
  AtomicInstructionSchema,
  z.object({ id: z.number(), type: z.literal('split'), by: SplitBySchema, listA: z.array(AtomicInstructionSchema), listB: z.array(AtomicInstructionSchema) }),
  z.object({ id: z.number(), type: z.literal('group'), label: z.string(), instructions: z.array(InstructionSchema) }),
])) as unknown as z.ZodType<Instruction>;

export const DancerStateSchema = z.object({
  x: z.number(),
  y: z.number(),
  facing: z.number(), // degrees: 0=north, 90=east, 180=south, 270=west
});
export type DancerState = z.infer<typeof DancerStateSchema>;

export const HandConnectionSchema = z.object({
  a: DancerIdSchema,
  ha: HandSchema,
  b: DancerIdSchema,
  hb: HandSchema,
});
export type HandConnection = z.infer<typeof HandConnectionSchema>;

export const KeyframeSchema = z.object({
  beat: z.number(),
  dancers: z.record(ProtoDancerIdSchema, DancerStateSchema) as z.ZodType<Record<ProtoDancerId, DancerState>>,
  hands: z.array(HandConnectionSchema),
  annotation: z.string().optional(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export function buildDancerRecord(f: (id: ProtoDancerId) => DancerState): Record<ProtoDancerId, DancerState> {
  return {
    up_lark: f('up_lark'),
    up_robin: f('up_robin'),
    down_lark: f('down_lark'),
    down_robin: f('down_robin'),
  };
}
