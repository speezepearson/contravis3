import { z } from 'zod';

// --- Leaf enums ---

export const RoleSchema = z.enum(['lark', 'robin']);
export type Role = z.infer<typeof RoleSchema>;

export const ProgressionDirSchema = z.enum(['up', 'down'])
export type ProgressionDir = z.infer<typeof ProgressionDirSchema>;

export const ProtoDancerIdSchema = z.templateLiteral([ProgressionDirSchema, '_', RoleSchema, '_0'])
export type ProtoDancerId = z.infer<typeof ProtoDancerIdSchema>;

export const DancerIdSchema = z.templateLiteral([ProgressionDirSchema, '_', RoleSchema, '_', z.number().int()])
export type DancerId = z.infer<typeof DancerIdSchema>;

null! as ProtoDancerId satisfies DancerId; // assert that ProtoDancerId < DancerId

export function parseDancerId(id: DancerId): { proto: ProtoDancerId; offset: number } {
  const i = id.lastIndexOf('_');
  return { proto: ProtoDancerIdSchema.parse(id.slice(0, i) + '_0'), offset: parseInt(id.slice(i + 1)) };
}

export function makeDancerId(proto: ProtoDancerId, offset: number): DancerId {
  const base = proto.slice(0, proto.lastIndexOf('_'));
  return DancerIdSchema.parse(`${base}_${offset}`);
}

export function dancerPosition(id: DancerId, dancers: Record<ProtoDancerId, DancerState>): DancerState {
  const { proto, offset } = parseDancerId(id);
  const b = dancers[proto];
  return { x: b.x, y: b.y + offset * 2, facing: b.facing };
}

export const HandSchema = z.enum(['left', 'right']);
export type Hand = z.infer<typeof HandSchema>;

export const TakeHandsHandSchema = z.enum(['left', 'right', 'inside']);
export type TakeHandsHand = z.infer<typeof TakeHandsHandSchema>;

export const RelationshipSchema = z.enum(['partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front']);
export type Relationship = z.infer<typeof RelationshipSchema>;

export const DropHandsTargetSchema = z.enum([
  'partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front',
  'left', 'right', 'both',
]);
export type DropHandsTarget = z.infer<typeof DropHandsTargetSchema>;

export const DirectionValueSchema = z.enum([
  'up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left',
]);
export type DirectionValue = z.infer<typeof DirectionValueSchema>;

export const RelativeDirectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('direction'), value: DirectionValueSchema }),
  z.object({ kind: z.literal('relationship'), value: RelationshipSchema }),
]);
export type RelativeDirection = z.infer<typeof RelativeDirectionSchema>;

// --- Atomic instruction variants ---

const TakeHandsSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('take_hands'),
  relationship: RelationshipSchema,
  hand: TakeHandsHandSchema,
});

const DropHandsInstructionSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('drop_hands'),
  target: DropHandsTargetSchema,
});

const AllemandeSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('allemande'),
  relationship: RelationshipSchema,
  handedness: HandSchema,
  rotations: z.number(),
});

const DoSiDoSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('do_si_do'),
  relationship: RelationshipSchema,
  rotations: z.number(),
});

const CircleSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('circle'),
  direction: HandSchema,
  rotations: z.number(),
});

const PullBySchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('pull_by'),
  relationship: RelationshipSchema,
  hand: HandSchema,
});

const TurnSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('turn'),
  target: RelativeDirectionSchema,
  offset: z.number(),
});

const StepSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('step'),
  direction: RelativeDirectionSchema,
  distance: z.number(),
});

const BalanceSchema = z.object({
  id: z.number(), beats: z.number(),
  type: z.literal('balance'),
  direction: RelativeDirectionSchema,
  distance: z.number(),
});

export const AtomicInstructionSchema = z.discriminatedUnion('type', [
  TakeHandsSchema, DropHandsInstructionSchema, AllemandeSchema, DoSiDoSchema,
  CircleSchema, PullBySchema, TurnSchema, StepSchema, BalanceSchema,
]).brand<'AtomicInstruction'>();
export type AtomicInstruction = z.infer<typeof AtomicInstructionSchema>;

export const SplitBySchema = z.enum(['role', 'position']);
export type SplitBy = z.infer<typeof SplitBySchema>;

// --- Instruction (recursive, so the type can't be purely inferred) ---

export type Instruction =
  | AtomicInstruction
  | { id: number; type: 'split'; by: SplitBy; listA: AtomicInstruction[]; listB: AtomicInstruction[] }
  | { id: number; type: 'group'; label: string; instructions: Instruction[] };

const SplitInstructionSchema = z.object({
  id: z.number(), type: z.literal('split'),
  by: SplitBySchema,
  listA: z.array(AtomicInstructionSchema),
  listB: z.array(AtomicInstructionSchema),
});

const GroupInstructionSchema: z.ZodType<
  { id: number; type: 'group'; label: string; instructions: Instruction[] }
> = z.object({
  id: z.number(), type: z.literal('group'),
  label: z.string(),
  instructions: z.lazy(() => z.array(InstructionSchema)),
});

export const InstructionSchema: z.ZodType<Instruction> = z.union([
  AtomicInstructionSchema,
  SplitInstructionSchema,
  GroupInstructionSchema,
]);

// --- State / rendering types ---

export const DancerStateSchema = z.object({
  x: z.number(),
  y: z.number(),
  facing: z.number(), // degrees: 0=north, 90=east, 180=south, 270=west
});
export type DancerState = z.infer<typeof DancerStateSchema>;

export const HandHoldSchema = z.tuple([DancerIdSchema, HandSchema]);
export type HandHold = z.infer<typeof HandHoldSchema>;

export const DancerHandsSchema = z.object({
  left: HandHoldSchema.optional(),
  right: HandHoldSchema.optional(),
}).partial();
export type DancerHands = z.infer<typeof DancerHandsSchema>;

const ProtoDancerRecord = <T extends z.ZodType>(v: T) => z.object({
  up_lark_0: v, up_robin_0: v, down_lark_0: v, down_robin_0: v,
});

export const KeyframeSchema = z.object({
  beat: z.number(),
  dancers: ProtoDancerRecord(DancerStateSchema),
  hands: ProtoDancerRecord(DancerHandsSchema),
  annotation: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const FormationSchema = z.enum(['beckett', 'improper']);
export type Formation = z.infer<typeof FormationSchema>;

export const DanceSchema = z.object({
  initFormation: FormationSchema,
  instructions: z.array(InstructionSchema),
}).brand<'Dance'>();
export type Dance = z.infer<typeof DanceSchema>;
