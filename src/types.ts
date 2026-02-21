import { z } from 'zod';
import { Vector } from 'vecti';

export { Vector } from 'vecti';

export const RoleSchema = z.enum(['lark', 'robin']);
export type Role = z.infer<typeof RoleSchema>;

export const ProgressionDirSchema = z.enum(['up', 'down']);
export type ProgressionDir = z.infer<typeof ProgressionDirSchema>;

export const ProtoDancerIdSchema = z.enum(['up_lark_0', 'up_robin_0', 'down_lark_0', 'down_robin_0']);
export type ProtoDancerId = z.infer<typeof ProtoDancerIdSchema>;

export const DancerIdSchema = z.templateLiteral([ProgressionDirSchema, '_', RoleSchema, '_', z.number().int()]);
export type DancerId = z.infer<typeof DancerIdSchema>;

// Compile-time check: every ProtoDancerId is a valid DancerId
// (the `satisfies` will fail if ProtoDancerId is not assignable to DancerId)
undefined as unknown as ProtoDancerId satisfies DancerId;

export function parseDancerId(id: DancerId): { proto: ProtoDancerId; offset: number } {
  const i = id.lastIndexOf('_');
  return { proto: ProtoDancerIdSchema.parse(`${id.slice(0, i)}_0`), offset: parseInt(id.slice(i + 1)) };
}

export function makeDancerId(proto: ProtoDancerId, offset: number): DancerId {
  return DancerIdSchema.parse(`${proto.slice(0, proto.lastIndexOf('_'))}_${offset}`);
}

export function dancerPosition(id: DancerId, dancers: Record<ProtoDancerId, DancerState>): DancerState {
  const { proto, offset } = parseDancerId(id);
  const b = dancers[proto];
  return { pos: new Vector(b.pos.x, b.pos.y + offset * 2), facing: b.facing };
}

// Who they interact with (only for actions that involve a partner)
export const RelationshipSchema = z.enum(['partner', 'neighbor', 'opposite', 'on_right', 'on_left', 'in_front', 'larks_left_robins_right', 'larks_right_robins_left']);
export type Relationship = z.infer<typeof RelationshipSchema>;

// What to drop: a relationship (drops hand connections between those pairs),
// a specific hand ('left'|'right'), or 'both' (all hand connections).
export const DropHandsTargetSchema = z.union([RelationshipSchema, z.enum(['left', 'right', 'both'])]);
export type DropHandsTarget = z.infer<typeof DropHandsTargetSchema>;

export const HandSchema = z.enum(['left', 'right']);
export const TakeHandSchema = z.enum(['left', 'right', 'both', 'inside']);
export type TakeHand = z.infer<typeof TakeHandSchema>;

export const InstructionIdSchema = z.string().uuid();
export type InstructionId = z.infer<typeof InstructionIdSchema>;

// Direction relative to a dancer: a named direction or a relationship
export const RelativeDirectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('direction'), value: z.enum(['up', 'down', 'across', 'out', 'progression', 'forward', 'back', 'right', 'left']) }),
  z.object({ kind: z.literal('relationship'), value: RelationshipSchema }),
]);
export type RelativeDirection = z.infer<typeof RelativeDirectionSchema>;

const baseFields = { id: InstructionIdSchema, beats: z.number() };

export const AtomicInstructionSchema = z.discriminatedUnion('type', [
  z.object({ ...baseFields, type: z.literal('take_hands'), relationship: RelationshipSchema, hand: TakeHandSchema }),
  z.object({ ...baseFields, type: z.literal('drop_hands'), target: DropHandsTargetSchema }),
  z.object({ ...baseFields, type: z.literal('allemande'), relationship: RelationshipSchema, handedness: HandSchema, rotations: z.number() }),
  z.object({ ...baseFields, type: z.literal('do_si_do'), relationship: RelationshipSchema, rotations: z.number() }),
  z.object({ ...baseFields, type: z.literal('circle'), direction: HandSchema, rotations: z.number() }),
  z.object({ ...baseFields, type: z.literal('pull_by'), relationship: RelationshipSchema, hand: HandSchema }),
  z.object({ ...baseFields, type: z.literal('step'), direction: RelativeDirectionSchema, distance: z.number(), facing: RelativeDirectionSchema, facingOffset: z.number() }),
  z.object({ ...baseFields, type: z.literal('balance'), direction: RelativeDirectionSchema, distance: z.number() }),
  z.object({ ...baseFields, type: z.literal('swing'), relationship: RelationshipSchema, endFacing: RelativeDirectionSchema }),
  z.object({ ...baseFields, type: z.literal('box_the_gnat'), relationship: RelationshipSchema }),
  z.object({ ...baseFields, type: z.literal('give_and_take_into_swing'), relationship: RelationshipSchema, role: RoleSchema, endFacing: RelativeDirectionSchema }),
  z.object({ ...baseFields, type: z.literal('mad_robin'), dir: z.enum(['larks_in_middle', 'robins_in_middle']), with: z.enum(['larks_left', 'robins_left']), rotations: z.number() }),
]);
export type AtomicInstruction = z.infer<typeof AtomicInstructionSchema>;

export const ActionTypeSchema = z.enum(['take_hands', 'drop_hands', 'allemande', 'do_si_do', 'circle', 'pull_by', 'step', 'balance', 'swing', 'box_the_gnat', 'give_and_take_into_swing', 'mad_robin']);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const SplitBySchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('role'), larks: z.array(AtomicInstructionSchema), robins: z.array(AtomicInstructionSchema) }),
  z.object({ by: z.literal('position'), ups: z.array(AtomicInstructionSchema), downs: z.array(AtomicInstructionSchema) }),
]);
export type SplitBy = z.infer<typeof SplitBySchema>;

/** Get the two sub-instruction lists from a split, in [groupA, groupB] order.
 *  role → [larks, robins], position → [ups, downs]. */
export function splitLists(split: SplitBy): [AtomicInstruction[], AtomicInstruction[]] {
  if (split.by === 'role') return [split.larks, split.robins];
  return [split.ups, split.downs];
}

/** Build a SplitBy with updated sub-instruction lists, preserving the discriminator. */
export function splitWithLists(by: SplitBy['by'], listA: AtomicInstruction[], listB: AtomicInstruction[]): SplitBy {
  if (by === 'role') return { by: 'role', larks: listA, robins: listB };
  return { by: 'position', ups: listA, downs: listB };
}

// Instruction is recursive (group contains Instruction[]), so we define the
// type manually with the brand baked in and annotate the schema accordingly.
export type Instruction = (
  | AtomicInstruction
  | { id: InstructionId; type: 'split' } & SplitBy
  | { id: InstructionId; type: 'group'; label: string; instructions: Instruction[] }
) & z.BRAND<'Instruction'>;

// The `as unknown as` double-cast bridges the gap between the unbranded
// schema output and our branded Instruction type.  At runtime z.lazy
// validates the full recursive structure; the cast only affects the
// compile-time type so that parse() returns branded Instructions.
export const InstructionSchema: z.ZodType<Instruction> = z.lazy(() => z.union([
  AtomicInstructionSchema,
  z.object({ id: InstructionIdSchema, type: z.literal('split'), by: z.literal('role'), larks: z.array(AtomicInstructionSchema), robins: z.array(AtomicInstructionSchema) }),
  z.object({ id: InstructionIdSchema, type: z.literal('split'), by: z.literal('position'), ups: z.array(AtomicInstructionSchema), downs: z.array(AtomicInstructionSchema) }),
  z.object({ id: InstructionIdSchema, type: z.literal('group'), label: z.string(), instructions: z.array(InstructionSchema) }),
])) as unknown as z.ZodType<Instruction>;

export function instructionDuration(instr: Instruction): number {
  if (instr.type === 'split') {
    const [listA, listB] = splitLists(instr);
    return Math.max(listA.reduce((s, i) => s + i.beats, 0),
                    listB.reduce((s, i) => s + i.beats, 0));
  }
  if (instr.type === 'group')
    return instr.instructions.reduce((s, i) => s + instructionDuration(i), 0);
  return instr.beats;
}

export const InitFormationSchema = z.enum(['improper', 'beckett']);
export type InitFormation = z.infer<typeof InitFormationSchema>;

export const ProgressionSchema = z.number().int();

export const DanceSchema = z.object({
  name: z.string().optional(),
  author: z.string().optional(),
  initFormation: InitFormationSchema,
  progression: ProgressionSchema,
  instructions: z.array(InstructionSchema),
});
export type Dance = z.infer<typeof DanceSchema>;

/**
 * Format a ZodError from DanceSchema.safeParse into a detailed, human-friendly
 * error message.  For issues inside instructions[i], the message identifies the
 * instruction index, its type, its beat-range, and the specific field problem.
 */
export function formatDanceParseError(error: z.ZodError, raw: unknown): string {
  const lines: string[] = [];
  const rawObj = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : null;
  const rawInstructions = Array.isArray(rawObj?.instructions) ? rawObj.instructions as unknown[] : null;

  // Compute cumulative beat offsets for raw instructions so we can report beat ranges
  function instrBeats(rawInstr: unknown): number {
    if (typeof rawInstr !== 'object' || rawInstr === null) return 0;
    const obj = rawInstr as Record<string, unknown>;
    if (typeof obj.beats === 'number') return obj.beats;
    // groups / splits: sum children
    if (obj.type === 'group' && Array.isArray(obj.instructions)) {
      return (obj.instructions as unknown[]).reduce((s: number, c) => s + instrBeats(c), 0);
    }
    if (obj.type === 'split') {
      const listA = Array.isArray(obj.larks) ? obj.larks : Array.isArray(obj.ups) ? obj.ups : [];
      const listB = Array.isArray(obj.robins) ? obj.robins : Array.isArray(obj.downs) ? obj.downs : [];
      const sumA = (listA as unknown[]).reduce((s: number, c) => s + instrBeats(c), 0);
      const sumB = (listB as unknown[]).reduce((s: number, c) => s + instrBeats(c), 0);
      return Math.max(sumA, sumB);
    }
    return 0;
  }

  function instrLabel(rawInstr: unknown, index: number): string {
    if (typeof rawInstr !== 'object' || rawInstr === null) return `instruction #${index + 1}`;
    const obj = rawInstr as Record<string, unknown>;
    const typePart = typeof obj.type === 'string' ? ` (${obj.type})` : '';
    return `instruction #${index + 1}${typePart}`;
  }

  // Group issues by instruction index for better readability
  for (const issue of error.issues) {
    const path = issue.path;
    if (path.length >= 2 && path[0] === 'instructions' && typeof path[1] === 'number') {
      const idx = path[1];
      const rawInstr = rawInstructions?.[idx];
      const label = instrLabel(rawInstr, idx);

      // Compute beat range
      let startBeat = 0;
      if (rawInstructions) {
        for (let j = 0; j < idx; j++) startBeat += instrBeats(rawInstructions[j]);
      }
      const duration = rawInstr ? instrBeats(rawInstr) : 0;
      const endBeat = startBeat + duration;
      const beatRange = `beats ${startBeat}\u2013${endBeat}`;

      const fieldPath = path.slice(2).join('.');
      const fieldPart = fieldPath ? ` at field "${fieldPath}"` : '';
      lines.push(`${label} (${beatRange})${fieldPart}: ${issue.message}`);
    } else {
      // Top-level field (initFormation, progression, etc.)
      const fieldPath = path.join('.');
      lines.push(`${fieldPath ? `"${fieldPath}"` : 'root'}: ${issue.message}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Unknown validation error';
}

export const VectorSchema = z.instanceof(Vector);

export const DancerStateSchema = z.object({
  pos: VectorSchema,
  facing: VectorSchema, // unit vector: NORTH = (0,1), EAST = (1,0)
});
export type DancerState = z.infer<typeof DancerStateSchema>;

// --- Direction constants (unit vectors) ---

/** Cardinal bearings (absolute directions). */
export const NORTH = new Vector(0, 1);
export const EAST = new Vector(1, 0);
export const SOUTH = new Vector(0, -1);
export const WEST = new Vector(-1, 0);

/** Convert a heading angle (radians, 0=north CW) to a unit vector. */
export function headingVector(radians: number): Vector {
  return new Vector(Math.sin(radians), Math.cos(radians));
}

/** Convert a unit facing vector to a heading angle (radians, 0=north CW). */
export function headingAngle(v: Vector): number {
  return Math.atan2(v.x, v.y);
}

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

/** A branded Keyframe that represents the authoritative final state of a figure.
 *  Figure generators receive this to ensure the final state is computed
 *  independently from intermediate keyframes. */
export type FinalKeyframe = Keyframe & z.BRAND<'FinalKeyframe'>;
export function makeFinalKeyframe(kf: Keyframe): FinalKeyframe {
  return kf as FinalKeyframe;
}

export function buildDancerRecord(f: (id: ProtoDancerId) => DancerState): Record<ProtoDancerId, DancerState> {
  return {
    up_lark_0: f('up_lark_0'),
    up_robin_0: f('up_robin_0'),
    down_lark_0: f('down_lark_0'),
    down_robin_0: f('down_robin_0'),
  };
}
