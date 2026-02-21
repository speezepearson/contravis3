import type { Instruction, AtomicInstruction, Keyframe, FinalKeyframe, HandConnection, ProtoDancerId, InitFormation, InstructionId } from './types';
import { Vector, dancerPosition, ProtoDancerIdSchema, buildDancerRecord, splitLists, NORTH, EAST, SOUTH, WEST } from './types';
import { assertNever } from './utils';
import { ALL_DANCERS, SPLIT_GROUPS } from './generateUtils';

import { finalTakeHands, generateTakeHands } from './figures/takeHands/takeHands';
import { finalDropHands, generateDropHands } from './figures/dropHands/dropHands';
import { finalAllemande, generateAllemande } from './figures/allemande/allemande';
import { finalStep, generateStep } from './figures/step/step';
import { finalBalance, generateBalance } from './figures/balance/balance';
import { finalDoSiDo, generateDoSiDo } from './figures/doSiDo/doSiDo';
import { finalCircle, generateCircle } from './figures/circle/circle';
import { finalPullBy, generatePullBy } from './figures/pullBy/pullBy';
import { finalSwing, generateSwing } from './figures/swing/swing';
import { finalBoxTheGnat, generateBoxTheGnat } from './figures/boxTheGnat/boxTheGnat';
import { finalGiveAndTakeIntoSwing, generateGiveAndTakeIntoSwing } from './figures/giveAndTakeIntoSwing/giveAndTakeIntoSwing';
import { finalMadRobin, generateMadRobin } from './figures/madRobin/madRobin';

export { ALL_DANCERS, SPLIT_GROUPS } from './generateUtils';

export class KeyframeGenerationError extends Error {
  readonly partialKeyframes: Keyframe[];
  readonly instructionId?: InstructionId;
  constructor(
    message: string,
    partialKeyframes: Keyframe[],
    instructionId?: InstructionId,
  ) {
    super(message);
    this.partialKeyframes = partialKeyframes;
    this.instructionId = instructionId;
  }
}

const PROTO_DANCER_IDS = ProtoDancerIdSchema.options;

const UPS = new Set<ProtoDancerId>(['up_lark_0', 'up_robin_0']);

function initialKeyframe(initFormation: InitFormation = 'improper'): Keyframe {
  if (initFormation === 'beckett') {
    return {
      beat: 0,
      dancers: {
        up_lark_0:    { pos: new Vector(-0.5,  0.5), facing: EAST },
        up_robin_0:   { pos: new Vector(-0.5, -0.5), facing: EAST },
        down_lark_0:  { pos: new Vector( 0.5, -0.5), facing: WEST },
        down_robin_0: { pos: new Vector( 0.5,  0.5), facing: WEST },
      },
      hands: [],
    };
  }
  return {
    beat: 0,
    dancers: {
      up_lark_0:    { pos: new Vector(-0.5, -0.5), facing: NORTH },
      up_robin_0:   { pos: new Vector( 0.5, -0.5), facing: NORTH },
      down_lark_0:  { pos: new Vector( 0.5,  0.5), facing: SOUTH },
      down_robin_0: { pos: new Vector(-0.5,  0.5), facing: SOUTH },
    },
    hands: [],
  };
}

// --- Process a list of atomic instructions with a given scope ---

/** Compute the authoritative final keyframe for a figure, independently of intermediates. */
function computeFinalKeyframe(prev: Keyframe, instr: AtomicInstruction, scope: Set<ProtoDancerId>): FinalKeyframe {
  switch (instr.type) {
    case 'take_hands':  return finalTakeHands(prev, instr, scope);
    case 'drop_hands':  return finalDropHands(prev, instr, scope);
    case 'allemande':   return finalAllemande(prev, instr, scope);
    case 'do_si_do':    return finalDoSiDo(prev, instr, scope);
    case 'circle':      return finalCircle(prev, instr, scope);
    case 'pull_by':     return finalPullBy(prev, instr, scope);
    case 'step':        return finalStep(prev, instr, scope);
    case 'balance':     return finalBalance(prev, instr, scope);
    case 'swing':       return finalSwing(prev, instr, scope);
    case 'box_the_gnat':             return finalBoxTheGnat(prev, instr, scope);
    case 'give_and_take_into_swing': return finalGiveAndTakeIntoSwing(prev, instr, scope);
    case 'mad_robin':                return finalMadRobin(prev, instr, scope);
    default: return assertNever(instr);
  }
}

/** Compute the intermediate keyframes for a figure (not including the final). */
function computeIntermediateKeyframes(prev: Keyframe, final: FinalKeyframe, instr: AtomicInstruction, scope: Set<ProtoDancerId>): Keyframe[] {
  switch (instr.type) {
    case 'take_hands':  return generateTakeHands(prev, final, instr, scope);
    case 'drop_hands':  return generateDropHands(prev, final, instr, scope);
    case 'allemande':   return generateAllemande(prev, final, instr, scope);
    case 'do_si_do':    return generateDoSiDo(prev, final, instr, scope);
    case 'circle':      return generateCircle(prev, final, instr, scope);
    case 'pull_by':     return generatePullBy(prev, final, instr, scope);
    case 'step':        return generateStep(prev, final, instr, scope);
    case 'balance':     return generateBalance(prev, final, instr, scope);
    case 'swing':       return generateSwing(prev, final, instr, scope);
    case 'box_the_gnat':             return generateBoxTheGnat(prev, final, instr, scope);
    case 'give_and_take_into_swing': return generateGiveAndTakeIntoSwing(prev, final, instr, scope);
    case 'mad_robin':                return generateMadRobin(prev, final, instr, scope);
    default: return assertNever(instr);
  }
}

function processAtomicInstruction(prev: Keyframe, instr: AtomicInstruction, scope: Set<ProtoDancerId>): Keyframe[] {
  const final = computeFinalKeyframe(prev, instr, scope);
  const intermediates = computeIntermediateKeyframes(prev, final, instr, scope);
  return [...intermediates, final];
}

function processInstructions(prev: Keyframe, instructions: AtomicInstruction[], scope: Set<ProtoDancerId>): Keyframe[] {
  const result: Keyframe[] = [];
  let current = prev;
  for (const instr of instructions) {
    try {
      const newFrames = processAtomicInstruction(current, instr, scope);
      result.push(...newFrames);
      if (newFrames.length > 0) {
        current = newFrames[newFrames.length - 1];
      }
    } catch (e) {
      const partial = e instanceof KeyframeGenerationError ? e.partialKeyframes : [];
      result.push(...partial);
      throw new KeyframeGenerationError(
        e instanceof Error ? e.message : String(e),
        result,
        e instanceof KeyframeGenerationError ? e.instructionId : instr.id,
      );
    }
  }
  return result;
}

// --- Split generation ---

/** Find the last keyframe at or before the given beat. */
function sampleAtBeat(timeline: Keyframe[], beat: number): Keyframe | null {
  let best: Keyframe | null = null;
  for (const kf of timeline) {
    if (kf.beat <= beat + 1e-9) {
      best = kf;
    } else {
      break;
    }
  }
  return best;
}

function mergeSplitTimelines(
  prev: Keyframe,
  groupA: Set<ProtoDancerId>,
  timelineA: Keyframe[],
  timelineB: Keyframe[],
): Keyframe[] {
  if (timelineA.length === 0 && timelineB.length === 0) {
    return [];
  }

  // Collect all unique beat values
  const beatSet = new Set<number>();
  for (const kf of timelineA) beatSet.add(kf.beat);
  for (const kf of timelineB) beatSet.add(kf.beat);
  const sortedBeats = [...beatSet].sort((a, b) => a - b);

  const merged: Keyframe[] = [];
  for (const beat of sortedBeats) {
    const kfA = sampleAtBeat(timelineA, beat);
    const kfB = sampleAtBeat(timelineB, beat);

    const dancers = buildDancerRecord(id => {
      const src = groupA.has(id)
        ? (kfA ? kfA.dancers[id] : prev.dancers[id])
        : (kfB ? kfB.dancers[id] : prev.dancers[id]);
      return { pos: src.pos, facing: src.facing };
    });

    // Merge hands: combine from both timelines, dedup by (a,b) pair
    const handsA = kfA ? kfA.hands : prev.hands;
    const handsB = kfB ? kfB.hands : prev.hands;
    const handMap = new Map<string, HandConnection>();
    for (const h of handsA) {
      const key = h.a < h.b ? `${h.a}:${h.b}` : `${h.b}:${h.a}`;
      handMap.set(key, h);
    }
    for (const h of handsB) {
      const key = h.a < h.b ? `${h.a}:${h.b}` : `${h.b}:${h.a}`;
      handMap.set(key, h);
    }

    merged.push({ beat, dancers, hands: [...handMap.values()] });
  }

  return merged;
}

function generateSplit(prev: Keyframe, instr: Extract<Instruction, { type: 'split' }>): Keyframe[] {
  const [groupA, groupB] = SPLIT_GROUPS[instr.by];
  const [listA, listB] = splitLists(instr);

  let timelineA: Keyframe[];
  let errorA: Error | null = null;
  try {
    timelineA = processInstructions(prev, listA, groupA);
  } catch (e) {
    timelineA = e instanceof KeyframeGenerationError ? e.partialKeyframes : [];
    errorA = e instanceof Error ? e : new Error(String(e));
  }

  let timelineB: Keyframe[];
  let errorB: Error | null = null;
  try {
    timelineB = processInstructions(prev, listB, groupB);
  } catch (e) {
    timelineB = e instanceof KeyframeGenerationError ? e.partialKeyframes : [];
    errorB = e instanceof Error ? e : new Error(String(e));
  }

  const merged = mergeSplitTimelines(prev, groupA, timelineA, timelineB);

  if (errorA || errorB) {
    const firstError = errorA ?? errorB;
    const instructionId = firstError instanceof KeyframeGenerationError ? firstError.instructionId : undefined;
    throw new KeyframeGenerationError(firstError!.message, merged, instructionId);
  }

  return merged;
}

// --- Top-level generator ---

function instructionDuration(instr: Instruction): number {
  if (instr.type === 'split') {
    const [listA, listB] = splitLists(instr);
    return Math.max(
      listA.reduce((s, i) => s + i.beats, 0),
      listB.reduce((s, i) => s + i.beats, 0)
    );
  }
  if (instr.type === 'group')
    return instr.instructions.reduce((s, i) => s + instructionDuration(i), 0);
  return instr.beats;
}

/** Flatten instructions into leaf-level beat ranges (recurses into groups). */
function buildBeatRanges(instructions: Instruction[]): { id: InstructionId; start: number; end: number }[] {
  const ranges: { id: InstructionId; start: number; end: number }[] = [];
  let cumBeat = 0;
  function walk(instrs: Instruction[]) {
    for (const instr of instrs) {
      if (instr.type === 'group') {
        walk(instr.instructions);
      } else {
        const dur = instructionDuration(instr);
        ranges.push({ id: instr.id, start: cumBeat, end: cumBeat + dur });
        cumBeat += dur;
      }
    }
  }
  walk(instructions);
  return ranges;
}

export function validateHandDistances(
  instructions: Instruction[],
  keyframes: Keyframe[],
  maxDistance = 1.2
): Map<InstructionId, string> {
  const ranges = buildBeatRanges(instructions);

  const warnings = new Map<InstructionId, string>();

  for (const kf of keyframes) {
    for (const hand of kf.hands) {
      const posA = dancerPosition(hand.a, kf.dancers);
      const posB = dancerPosition(hand.b, kf.dancers);
      const dist = posA.pos.subtract(posB.pos).length();
      if (dist > maxDistance) {
        // Find the instruction owning this beat
        for (const r of ranges) {
          if (kf.beat >= r.start - 1e-9 && kf.beat <= r.end + 1e-9) {
            if (!warnings.has(r.id)) {
              warnings.set(r.id, `Hands too far apart (${dist.toFixed(2)}m)`);
            }
            break;
          }
        }
      }
    }
  }

  return warnings;
}

export function validateProgression(
  keyframes: Keyframe[],
  initFormation: InitFormation,
  progression: number,
): string | null {
  if (keyframes.length === 0) return null;
  const init = initialKeyframe(initFormation);
  const final = keyframes[keyframes.length - 1];
  const expectedDy = progression;
  const problems: string[] = [];
  for (const id of PROTO_DANCER_IDS) {
    const sign = UPS.has(id) ? 1 : -1;
    const expectedX = init.dancers[id].pos.x;
    const expectedY = init.dancers[id].pos.y + sign * expectedDy;
    const dx = final.dancers[id].pos.x - expectedX;
    const dy = final.dancers[id].pos.y - expectedY;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.05) {
      problems.push(`${id} started at (${init.dancers[id].pos.x.toFixed(2)}, ${init.dancers[id].pos.y.toFixed(2)}), should have ended at (${expectedX.toFixed(2)}, ${expectedY.toFixed(2)}), but actually ended at (${final.dancers[id].pos.x.toFixed(2)}, ${final.dancers[id].pos.y.toFixed(2)})`);
    }
  }
  if (problems.length === 0) return null;
  return `Dancers don't end at expected progression positions: ${problems.join('; ')}`;
}

function processTopLevelInstruction(prev: Keyframe, instr: Instruction): Keyframe[] {
  if (instr.type === 'split') {
    return generateSplit(prev, instr);
  } else if (instr.type === 'group') {
    const result: Keyframe[] = [];
    let current = prev;
    for (const child of instr.instructions) {
      try {
        const childFrames = processTopLevelInstruction(current, child);
        result.push(...childFrames);
        if (childFrames.length > 0) {
          current = childFrames[childFrames.length - 1];
        }
      } catch (e) {
        const partial = e instanceof KeyframeGenerationError ? e.partialKeyframes : [];
        result.push(...partial);
        throw new KeyframeGenerationError(
          e instanceof Error ? e.message : String(e),
          result,
          e instanceof KeyframeGenerationError ? e.instructionId : child.id,
        );
      }
    }
    return result;
  } else {
    return processAtomicInstruction(prev, instr, ALL_DANCERS);
  }
}

export interface GenerateError {
  instructionId: InstructionId;
  message: string;
}

export interface GenerateResult {
  keyframes: Keyframe[];
  error: GenerateError | null;
}

export function generateAllKeyframes(instructions: Instruction[], initFormation?: InitFormation): GenerateResult {
  const keyframes: Keyframe[] = [initialKeyframe(initFormation)];

  for (const instr of instructions) {
    const prev = keyframes[keyframes.length - 1];
    try {
      const newFrames = processTopLevelInstruction(prev, instr);
      keyframes.push(...newFrames);
    } catch (e) {
      if (e instanceof KeyframeGenerationError) {
        keyframes.push(...e.partialKeyframes);
      }
      const instructionId = e instanceof KeyframeGenerationError && e.instructionId ? e.instructionId : instr.id;
      return {
        keyframes,
        error: { instructionId, message: e instanceof Error ? e.message : String(e) },
      };
    }
  }

  return { keyframes, error: null };
}

/** Find the beat at which a specific instruction starts, by walking the tree. */
export function findInstructionStartBeat(instructions: Instruction[], targetId: InstructionId): number | null {
  function walk(instrs: Instruction[], baseBeat: number): number | null {
    let beat = baseBeat;
    for (const instr of instrs) {
      if (instr.id === targetId) return beat;
      if (instr.type === 'group') {
        const result = walk(instr.instructions, beat);
        if (result !== null) return result;
      } else if (instr.type === 'split') {
        const [listA, listB] = splitLists(instr);
        let b = beat;
        for (const sub of listA) {
          if (sub.id === targetId) return b;
          b += sub.beats;
        }
        b = beat;
        for (const sub of listB) {
          if (sub.id === targetId) return b;
          b += sub.beats;
        }
      }
      beat += instructionDuration(instr);
    }
    return null;
  }
  return walk(instructions, 0);
}

/** Find the dancer scope for a specific instruction (ALL_DANCERS unless inside a split). */
export function findInstructionScope(instructions: Instruction[], targetId: InstructionId): Set<ProtoDancerId> {
  for (const instr of instructions) {
    if (instr.id === targetId) return ALL_DANCERS;
    if (instr.type === 'group') {
      const result = findInstructionScope(instr.instructions, targetId);
      if (result !== ALL_DANCERS || instr.instructions.some(c => instructionContainsId(c, targetId))) return result;
    }
    if (instr.type === 'split') {
      const [groupA, groupB] = SPLIT_GROUPS[instr.by];
      const [listA, listB] = splitLists(instr);
      for (const sub of listA) {
        if (sub.id === targetId) return groupA;
      }
      for (const sub of listB) {
        if (sub.id === targetId) return groupB;
      }
    }
  }
  return ALL_DANCERS;
}

function instructionContainsId(instr: Instruction, id: InstructionId): boolean {
  if (instr.id === id) return true;
  if (instr.type === 'group') return instr.instructions.some(c => instructionContainsId(c, id));
  if (instr.type === 'split') {
    const [listA, listB] = splitLists(instr);
    return [...listA, ...listB].some(s => s.id === id);
  }
  return false;
}

/** Generate preview keyframes for a single instruction given a starting keyframe and scope.
 *  Returns null if generation fails (e.g., parse error in the instruction). */
export function generateInstructionPreview(
  instruction: Instruction,
  prevKeyframe: Keyframe,
  scope: Set<ProtoDancerId>,
): Keyframe[] | null {
  try {
    if (instruction.type === 'split') {
      return generateSplit(prevKeyframe, instruction);
    } else if (instruction.type === 'group') {
      const result: Keyframe[] = [];
      let current = prevKeyframe;
      for (const child of instruction.instructions) {
        const childFrames = processTopLevelInstruction(current, child);
        result.push(...childFrames);
        if (childFrames.length > 0) current = childFrames[childFrames.length - 1];
      }
      return result;
    } else {
      return processAtomicInstruction(prevKeyframe, instruction, scope);
    }
  } catch {
    return null;
  }
}
