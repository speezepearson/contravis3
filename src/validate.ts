import type { Instruction, Keyframe, DancerId, InstructionId } from "./types";
import {
  PROTO_DANCER_IDS,
  makeDancerId,
  dancerPosition,
  parseDancerId,
} from "./types";
import { instructionDuration } from "./instruction-tree";

/** Flatten instructions into leaf-level beat ranges (recurses into groups). */
function buildBeatRanges(
  instructions: Instruction[],
): { id: InstructionId; start: number; end: number }[] {
  const ranges: { id: InstructionId; start: number; end: number }[] = [];
  let cumBeat = 0;
  function walk(instrs: Instruction[]) {
    for (const instr of instrs) {
      if (instr.type === "group") {
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
  maxDistance = 1.2,
): Map<InstructionId, string> {
  const ranges = buildBeatRanges(instructions);

  const warnings = new Map<InstructionId, string>();

  for (const kf of keyframes) {
    for (const proto of PROTO_DANCER_IDS) {
      const dh = kf.hands[proto];
      for (const hand of ["left", "right"] as const) {
        const held = dh[hand];
        if (!held) continue;
        const posA = dancerPosition(makeDancerId(proto, 0), kf.dancers);
        const posB = dancerPosition(held[0], kf.dancers);
        const dist = Math.hypot(posA.x - posB.x, posA.y - posB.y);
        if (dist > maxDistance) {
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
  }

  return warnings;
}

export function collectKeyframeWarnings(
  instructions: Instruction[],
  keyframes: Keyframe[],
): Map<InstructionId, string> {
  const ranges = buildBeatRanges(instructions);
  const warnings = new Map<InstructionId, string>();
  for (const kf of keyframes) {
    if (!kf.warnings?.length) continue;
    for (const r of ranges) {
      if (kf.beat >= r.start - 1e-9 && kf.beat <= r.end + 1e-9) {
        if (!warnings.has(r.id)) {
          warnings.set(r.id, kf.warnings.join("; "));
        }
        break;
      }
    }
  }
  return warnings;
}

export function validateHandSymmetry(keyframes: Keyframe[]): string[] {
  const errors: string[] = [];
  for (const kf of keyframes) {
    for (const proto of PROTO_DANCER_IDS) {
      for (const hand of ["left", "right"] as const) {
        const held = kf.hands[proto][hand];
        if (!held) continue;
        const [targetId, targetHand] = held;
        const { proto: targetProto, offset } = parseDancerId(targetId);
        const reverse = kf.hands[targetProto][targetHand];
        const expectedReverse: DancerId = makeDancerId(proto, -offset);
        if (!reverse) {
          errors.push(
            `Beat ${kf.beat}: ${proto}.${hand} -> ${targetId}.${targetHand}, but ${targetProto}.${targetHand} is empty`,
          );
        } else if (reverse[0] !== expectedReverse || reverse[1] !== hand) {
          errors.push(
            `Beat ${kf.beat}: ${proto}.${hand} -> ${targetId}.${targetHand}, but ${targetProto}.${targetHand} -> ${reverse[0]}.${reverse[1]} (expected ${expectedReverse}.${hand})`,
          );
        }
      }
    }
  }
  return errors;
}
