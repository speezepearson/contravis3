import { arrayMove } from "@dnd-kit/sortable";
import type {
  Instruction,
  AtomicInstruction,
  InstructionId,
  SplitInstruction,
} from "./types";
import { instructionIdNonce, splitLists } from "./types";

// --- Fold / catamorphism ---

export function foldInstruction<T>(
  instr: Instruction,
  handlers: {
    atomic: (instr: AtomicInstruction) => T;
    split: (instr: SplitInstruction, first: T[], second: T[]) => T;
    group: (instr: Extract<Instruction, { type: "group" }>, children: T[]) => T;
  },
): T {
  switch (instr.type) {
    case "split": {
      const [first, second] = splitLists(instr);
      return handlers.split(
        instr,
        first.map((a) => handlers.atomic(a)),
        second.map((a) => handlers.atomic(a)),
      );
    }
    case "group":
      return handlers.group(
        instr,
        instr.instructions.map((c) => foldInstruction(c, handlers)),
      );
    default:
      return handlers.atomic(instr);
  }
}

// --- Derived queries ---

export function instructionDuration(instr: Instruction): number {
  return foldInstruction(instr, {
    atomic: (i) => i.beats,
    split: (_i, listA, listB) =>
      Math.max(
        listA.reduce((s, b) => s + b, 0),
        listB.reduce((s, b) => s + b, 0),
      ),
    group: (_i, children) => children.reduce((s, d) => s + d, 0),
  });
}

export function instructionContainsId(
  instr: Instruction,
  id: InstructionId,
): boolean {
  return foldInstruction(instr, {
    atomic: (i) => i.id === id,
    split: (i, listA, listB) =>
      i.id === id || listA.some(Boolean) || listB.some(Boolean),
    group: (i, children) => i.id === id || children.some(Boolean),
  });
}

export function maxInstructionNonce(instrs: Instruction[]): number {
  let m = 0;
  for (const instr of instrs) {
    m = Math.max(
      m,
      foldInstruction(instr, {
        atomic: (a) => instructionIdNonce(a.id),
        split: (s, listA, listB) =>
          Math.max(instructionIdNonce(s.id), ...listA, ...listB),
        group: (g, children) => Math.max(instructionIdNonce(g.id), ...children),
      }),
    );
  }
  return m;
}

export function findInstructionById(
  instrs: Instruction[],
  id: InstructionId,
): Instruction | null {
  for (const i of instrs) {
    if (i.id === id) return i;
    if (i.type === "group") {
      const found = findInstructionById(i.instructions, id);
      if (found) return found;
    }
    if (i.type === "split") {
      const [first, second] = splitLists(i);
      for (const s of [...first, ...second]) {
        if (s.id === id) return s;
      }
    }
  }
  return null;
}

// --- DnD container helpers ---

export function parseContainerId(
  id: string,
):
  | { type: "top" }
  | { type: "group"; groupId: InstructionId }
  | { type: "split"; splitId: InstructionId; list: "first" | "second" } {
  if (id === "top") return { type: "top" };
  const groupMatch = id.match(/^group-(insn_\d+)$/);
  if (groupMatch)
    return { type: "group", groupId: groupMatch[1] as InstructionId };
  const splitMatch = id.match(/^split-(insn_\d+)-(first|second)$/);
  if (splitMatch)
    return {
      type: "split",
      splitId: splitMatch[1] as InstructionId,
      list: splitMatch[2] as "first" | "second",
    };
  return { type: "top" };
}

function splitKey(
  by: "role" | "position",
  list: "first" | "second",
): "larks" | "robins" | "ups" | "downs" {
  if (by === "role") return list === "first" ? "larks" : "robins";
  return list === "first" ? "ups" : "downs";
}

export function removeFromTree(
  instrs: Instruction[],
  targetId: InstructionId,
): [Instruction[], Instruction | null] {
  const topIdx = instrs.findIndex((i) => i.id === targetId);
  if (topIdx !== -1) {
    return [
      [...instrs.slice(0, topIdx), ...instrs.slice(topIdx + 1)],
      instrs[topIdx],
    ];
  }
  let removed: Instruction | null = null;
  const mapped = instrs.map((i) => {
    if (removed) return i;
    if (i.type === "split") {
      const [first, second] = splitLists(i);
      const firstKey = splitKey(i.by, "first");
      const secondKey = splitKey(i.by, "second");
      const aIdx = first.findIndex((s) => s.id === targetId);
      if (aIdx !== -1) {
        removed = first[aIdx];
        return {
          ...i,
          [firstKey]: [...first.slice(0, aIdx), ...first.slice(aIdx + 1)],
        };
      }
      const bIdx = second.findIndex((s) => s.id === targetId);
      if (bIdx !== -1) {
        removed = second[bIdx];
        return {
          ...i,
          [secondKey]: [...second.slice(0, bIdx), ...second.slice(bIdx + 1)],
        };
      }
    }
    if (i.type === "group") {
      const [newChildren, r] = removeFromTree(i.instructions, targetId);
      if (r) {
        removed = r;
        return { ...i, instructions: newChildren };
      }
    }
    return i;
  });
  return [mapped, removed];
}

export function insertIntoContainer(
  instrs: Instruction[],
  containerId: string,
  item: Instruction,
  index: number,
): Instruction[] {
  const parsed = parseContainerId(containerId);
  if (parsed.type === "top") {
    const copy = [...instrs];
    copy.splice(index, 0, item);
    return copy;
  }
  return instrs.map((i) => {
    if (
      parsed.type === "group" &&
      i.type === "group" &&
      i.id === parsed.groupId
    ) {
      const copy = [...i.instructions];
      copy.splice(index, 0, item);
      return { ...i, instructions: copy };
    }
    if (
      parsed.type === "split" &&
      i.type === "split" &&
      i.id === parsed.splitId
    ) {
      const key = splitKey(i.by, parsed.list);
      const copy = [
        ...((i as Record<string, unknown>)[key] as AtomicInstruction[]),
      ];
      copy.splice(index, 0, item as AtomicInstruction);
      return { ...i, [key]: copy };
    }
    if (i.type === "group") {
      return {
        ...i,
        instructions: insertIntoContainer(
          i.instructions,
          containerId,
          item,
          index,
        ),
      };
    }
    return i;
  });
}

export function reorderInContainer(
  instrs: Instruction[],
  containerId: string,
  oldIndex: number,
  newIndex: number,
): Instruction[] {
  const parsed = parseContainerId(containerId);
  if (parsed.type === "top") return arrayMove(instrs, oldIndex, newIndex);
  return instrs.map((i) => {
    if (
      parsed.type === "group" &&
      i.type === "group" &&
      i.id === parsed.groupId
    ) {
      return {
        ...i,
        instructions: arrayMove(i.instructions, oldIndex, newIndex),
      };
    }
    if (
      parsed.type === "split" &&
      i.type === "split" &&
      i.id === parsed.splitId
    ) {
      const key = splitKey(i.by, parsed.list);
      return {
        ...i,
        [key]: arrayMove(
          (i as Record<string, unknown>)[key] as AtomicInstruction[],
          oldIndex,
          newIndex,
        ),
      };
    }
    if (i.type === "group") {
      return {
        ...i,
        instructions: reorderInContainer(
          i.instructions,
          containerId,
          oldIndex,
          newIndex,
        ),
      };
    }
    return i;
  });
}

export function getContainerItems(
  instrs: Instruction[],
  containerId: string,
): Instruction[] | null {
  const parsed = parseContainerId(containerId);
  if (parsed.type === "top") return instrs;
  for (const i of instrs) {
    if (
      parsed.type === "group" &&
      i.type === "group" &&
      i.id === parsed.groupId
    )
      return i.instructions;
    if (
      parsed.type === "split" &&
      i.type === "split" &&
      i.id === parsed.splitId
    ) {
      const [first, second] = splitLists(i);
      return parsed.list === "first" ? first : second;
    }
    if (i.type === "group") {
      const found = getContainerItems(i.instructions, containerId);
      if (found !== null) return found;
    }
  }
  return null;
}
