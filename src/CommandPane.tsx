import { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SearchableDropdown from "./SearchableDropdown";
import type { SearchableDropdownHandle } from "./SearchableDropdown";
import type {
  Instruction,
  AtomicInstruction,
  Relationship,
  RelativeDirection,
  SplitBy,
  DropHandsTarget,
  InstructionId,
  SplitInstruction,
} from "./types";
import {
  AtomicInstructionSchema,
  DanceSchema,
  makeInstructionId,
  splitLists,
} from "./types";
import { assertNever } from "./utils";
import {
  instructionDuration,
  instructionContainsId,
  maxInstructionNonce,
  findInstructionById,
  parseContainerId,
  removeFromTree,
  insertIntoContainer,
  reorderInContainer,
  getContainerItems,
} from "./instruction-tree";

type ActionType = AtomicInstruction["type"];

const DIR_OPTIONS = [
  "up",
  "down",
  "across",
  "out",
  "progression",
  "forward",
  "back",
  "right",
  "left",
  "partner",
  "neighbor",
  "opposite",
];

const ACTION_OPTIONS: (ActionType | "split" | "group")[] = [
  "take_hands",
  "drop_hands",
  "allemande",
  "do_si_do",
  "circle",
  "pull_by",
  "turn",
  "step",
  "balance",
  "split",
  "group",
];
const ACTION_LABELS: Record<ActionType | "split" | "group", string> = {
  take_hands: "take hands",
  drop_hands: "drop hands",
  allemande: "allemande",
  do_si_do: "do-si-do",
  circle: "circle",
  pull_by: "pull by",
  turn: "turn",
  step: "step",
  balance: "balance",
  split: "split",
  group: "group",
};

const SPLIT_BY_OPTIONS = ["role", "position"];
const SPLIT_BY_LABELS: Record<SplitBy, string> = {
  role: "role (larks / robins)",
  position: "position (ups / downs)",
};

const RELATIONSHIP_OPTIONS: Relationship[] = [
  "partner",
  "neighbor",
  "opposite",
  "on_right",
  "on_left",
  "in_front",
];
const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  partner: "partner",
  neighbor: "neighbor",
  opposite: "opposite",
  on_right: "on your right",
  on_left: "on your left",
  in_front: "in front of you",
};

const DROP_TARGET_OPTIONS: DropHandsTarget[] = [
  "partner",
  "neighbor",
  "opposite",
  "on_right",
  "on_left",
  "in_front",
  "right",
  "left",
  "both",
];
const DROP_TARGET_LABELS: Record<DropHandsTarget, string> = {
  partner: "partner hands",
  neighbor: "neighbor hands",
  opposite: "opposite hands",
  on_right: "on-your-right hands",
  on_left: "on-your-left hands",
  in_front: "in-front hands",
  right: "right hand",
  left: "left hand",
  both: "both hands",
};

const HAND_OPTIONS = ["right", "left"];
const TAKE_HANDS_HAND_OPTIONS = ["right", "left", "inside"];
const CIRCLE_DIR_OPTIONS = ["left", "right"];

function parseDirection(text: string): RelativeDirection | null {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return null;
  const directions = new Set([
    "up",
    "down",
    "across",
    "out",
    "progression",
    "forward",
    "back",
    "right",
    "left",
  ]);
  const relationships = new Set(["partner", "neighbor", "opposite"]);
  if (directions.has(trimmed))
    return {
      kind: "direction",
      value: trimmed as RelativeDirection & { kind: "direction" } extends {
        value: infer V;
      }
        ? V
        : never,
    };
  if (relationships.has(trimmed))
    return { kind: "relationship", value: trimmed as Relationship };
  return null;
}

function directionToText(dir: RelativeDirection): string {
  if (dir.kind === "direction") return dir.value;
  return dir.value;
}

function splitGroupLabel(by: SplitBy, list: "first" | "second"): string {
  if (by === "role") return list === "first" ? "Larks" : "Robins";
  return list === "first" ? "Ups" : "Downs";
}

function sumBeats(instructions: AtomicInstruction[]): number {
  return instructions.reduce((sum, i) => sum + i.beats, 0);
}

function defaultBeats(action: string): string {
  switch (action) {
    case "allemande":
      return "8";
    case "do_si_do":
      return "8";
    case "circle":
      return "8";
    case "pull_by":
      return "2";
    case "step":
      return "2";
    case "balance":
      return "4";
    default:
      return "0";
  }
}

interface Props {
  instructions: Instruction[];
  setInstructions: (instructions: Instruction[]) => void;
  activeId: InstructionId | null;
  warnings: Map<InstructionId, string>;
}

function summarizeAtomic(instr: AtomicInstruction): string {
  switch (instr.type) {
    case "take_hands": {
      const r = instr.relationship;
      const label =
        r === "on_right"
          ? "on-your-right"
          : r === "on_left"
            ? "on-your-left"
            : r === "in_front"
              ? "in-front"
              : `${r}s`;
      return `${label} take ${instr.hand} hands`;
    }
    case "drop_hands": {
      const t = instr.target;
      if (t === "both") return "drop all hands";
      if (t === "left" || t === "right") return `drop ${t} hand`;
      const label =
        t === "on_right"
          ? "on-your-right"
          : t === "on_left"
            ? "on-your-left"
            : t === "in_front"
              ? "in-front"
              : t;
      return `drop ${label} hands`;
    }
    case "allemande": {
      const r = instr.relationship;
      const label =
        r === "on_right"
          ? "on-your-right"
          : r === "on_left"
            ? "on-your-left"
            : r === "in_front"
              ? "in-front"
              : r;
      return `${label} allemande ${instr.handedness} ${instr.rotations}x (${instr.beats}b)`;
    }
    case "do_si_do": {
      const r = instr.relationship;
      const label =
        r === "on_right"
          ? "on-your-right"
          : r === "on_left"
            ? "on-your-left"
            : r === "in_front"
              ? "in-front"
              : r;
      return `${label} do-si-do ${instr.rotations}x (${instr.beats}b)`;
    }
    case "circle":
      return `circle ${instr.direction} ${instr.rotations}x (${instr.beats}b)`;
    case "pull_by": {
      const r = instr.relationship;
      const label =
        r === "on_right"
          ? "on-your-right"
          : r === "on_left"
            ? "on-your-left"
            : r === "in_front"
              ? "in-front"
              : r;
      return `${label} pull by ${instr.hand} (${instr.beats}b)`;
    }
    case "turn": {
      const desc = instr.target.value;
      const offsetStr = instr.offset ? ` +${instr.offset}\u00B0` : "";
      return `turn ${desc}${offsetStr} (${instr.beats}b)`;
    }
    case "step":
      return `step ${instr.direction.value} ${instr.distance} (${instr.beats}b)`;
    case "balance":
      return `balance ${instr.direction.value} ${instr.distance} (${instr.beats}b)`;
  }
}

function summarize(instr: Instruction): string {
  if (instr.type === "split") {
    const [first, second] = splitLists(instr);
    const totalBeats = Math.max(sumBeats(first), sumBeats(second));
    return `split by ${instr.by} (${totalBeats}b)`;
  }
  if (instr.type === "group") {
    const totalBeats = instructionDuration(instr);
    return `${instr.label} (${totalBeats}b)`;
  }
  return summarizeAtomic(instr);
}

function SortableItem({
  id,
  children,
}: {
  id: InstructionId;
  children: (dragHandleProps: Record<string, unknown>) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

function DropZone({ containerId }: { containerId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  return (
    <div
      ref={setNodeRef}
      className={`drop-zone${isOver ? " drop-zone-active" : ""}`}
    />
  );
}

export default function CommandPane({
  instructions,
  setInstructions,
  activeId,
  warnings,
}: Props) {
  const [addingAt, setAddingAt] = useState<{
    containerId: string;
    index: number;
  } | null>(null);
  const [action, setAction] = useState<ActionType | "split" | "group" | null>(
    null,
  );
  const [relationship, setRelationship] = useState<Relationship>("neighbor");
  const [dropTarget, setDropTarget] = useState<DropHandsTarget>("neighbor");
  const [hand, setHand] = useState<"left" | "right" | "inside">("right");
  const [handedness, setHandedness] = useState<"left" | "right">("right");
  const [rotations, setRotations] = useState("1");
  const [turnText, setTurnText] = useState("");
  const [turnOffset, setTurnOffset] = useState("0");
  const [stepText, setStepText] = useState("");
  const [balanceText, setBalanceText] = useState("");
  const [distance, setDistance] = useState("0.2");
  const [beats, setBeats] = useState("0");
  const [splitBy, setSplitBy] = useState<SplitBy>("role");
  const [groupLabel, setGroupLabel] = useState("");
  const [editingId, setEditingId] = useState<InstructionId | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const actionRef = useRef<SearchableDropdownHandle>(null);
  const nextNonce = useRef(maxInstructionNonce(instructions) + 1);

  function loadAtomicIntoForm(instr: AtomicInstruction) {
    setAction(instr.type);
    setBeats(String(instr.beats));
    if (instr.type === "take_hands") {
      setRelationship(instr.relationship);
      setHand(instr.hand);
    } else if (instr.type === "drop_hands") {
      setDropTarget(instr.target);
    } else if (instr.type === "allemande") {
      setRelationship(instr.relationship);
      setHandedness(instr.handedness);
      setRotations(String(instr.rotations));
    } else if (instr.type === "do_si_do") {
      setRelationship(instr.relationship);
      setRotations(String(instr.rotations));
    } else if (instr.type === "circle") {
      setHandedness(instr.direction);
      setRotations(String(instr.rotations));
    } else if (instr.type === "pull_by") {
      setRelationship(instr.relationship);
      setHand(instr.hand);
    } else if (instr.type === "turn") {
      setTurnText(directionToText(instr.target));
      setTurnOffset(String(instr.offset));
    } else if (instr.type === "step") {
      setStepText(directionToText(instr.direction));
      setDistance(String(instr.distance));
    } else if (instr.type === "balance") {
      setBalanceText(directionToText(instr.direction));
      setDistance(String(instr.distance));
    }
  }

  function loadIntoForm(instr: Instruction) {
    if (instr.type === "split") {
      setAction("split");
      setSplitBy(instr.by);
    } else if (instr.type === "group") {
      setAction("group");
      setGroupLabel(instr.label);
    } else {
      loadAtomicIntoForm(instr);
    }
  }

  function buildAtomicInstruction(id: InstructionId): AtomicInstruction {
    const base = { id, beats: Number(beats) || 0 };
    const a = action;
    if (a === "split" || a === "group" || a === null)
      throw new Error(
        `buildAtomicInstruction called with non-atomic action: ${a}`,
      );
    let raw;
    switch (a) {
      case "take_hands":
        raw = { id, beats: 0, type: "take_hands" as const, relationship, hand };
        break;
      case "drop_hands":
        raw = { id, beats: 0, type: "drop_hands" as const, target: dropTarget };
        break;
      case "allemande":
        raw = {
          ...base,
          type: "allemande" as const,
          relationship,
          handedness,
          rotations: Number(rotations) || 1,
        };
        break;
      case "do_si_do":
        raw = {
          ...base,
          type: "do_si_do" as const,
          relationship,
          rotations: Number(rotations) || 1,
        };
        break;
      case "circle":
        raw = {
          ...base,
          type: "circle" as const,
          direction: handedness,
          rotations: Number(rotations) || 1,
        };
        break;
      case "pull_by":
        raw = {
          ...base,
          type: "pull_by" as const,
          relationship,
          hand: hand === "inside" ? ("right" as const) : hand,
        };
        break;
      case "turn": {
        const target = parseDirection(turnText) ?? {
          kind: "direction" as const,
          value: "up" as const,
        };
        raw = {
          ...base,
          type: "turn" as const,
          target,
          offset: Number(turnOffset) || 0,
        };
        break;
      }
      case "step": {
        const dir = parseDirection(stepText) ?? {
          kind: "direction" as const,
          value: "up" as const,
        };
        raw = {
          ...base,
          type: "step" as const,
          direction: dir,
          distance: Number(distance) || 0,
        };
        break;
      }
      case "balance": {
        const dir = parseDirection(balanceText) ?? {
          kind: "direction" as const,
          value: "across" as const,
        };
        raw = {
          ...base,
          type: "balance" as const,
          direction: dir,
          distance: Number(distance) || 0,
        };
        break;
      }
      default:
        assertNever(a);
    }
    return AtomicInstructionSchema.parse(raw);
  }

  function buildInstruction(id: InstructionId): Instruction {
    if (action === null) throw new Error("No action selected");
    if (action === "group") {
      const existing = findInstructionById(instructions, id);
      const children = existing?.type === "group" ? existing.instructions : [];
      return {
        id,
        type: "group",
        label: groupLabel || "Untitled",
        instructions: children,
      };
    }
    if (action === "split") {
      const existing = findInstructionById(instructions, id);
      const [prevFirst, prevSecond] =
        existing?.type === "split"
          ? splitLists(existing)
          : [[] as AtomicInstruction[], [] as AtomicInstruction[]];
      if (splitBy === "role") {
        return {
          id,
          type: "split",
          by: "role",
          larks: prevFirst,
          robins: prevSecond,
        };
      }
      return {
        id,
        type: "split",
        by: "position",
        ups: prevFirst,
        downs: prevSecond,
      };
    }
    return buildAtomicInstruction(id);
  }

  function replaceInTree(
    instrs: Instruction[],
    id: InstructionId,
    replacement: Instruction,
  ): Instruction[] {
    return instrs.map((i) => {
      if (i.id === id) return replacement;
      if (i.type === "group") {
        return {
          ...i,
          instructions: replaceInTree(i.instructions, id, replacement),
        };
      }
      if (i.type === "split") {
        const [first, second] = splitLists(i);
        const newFirst = first.map((s) =>
          s.id === id ? (replacement as AtomicInstruction) : s,
        );
        const newSecond = second.map((s) =>
          s.id === id ? (replacement as AtomicInstruction) : s,
        );
        if (i.by === "role") {
          return { ...i, larks: newFirst, robins: newSecond };
        }
        return { ...i, ups: newFirst, downs: newSecond };
      }
      return i;
    });
  }

  function resetForm() {
    setAction(null);
    setBeats("0");
  }

  function add() {
    if (action === null) return;
    if (editingId !== null) {
      const replacement = buildInstruction(editingId);
      setInstructions(replaceInTree(instructions, editingId, replacement));
      setEditingId(null);
    } else if (addingAt !== null) {
      const newInstr = buildInstruction(makeInstructionId(nextNonce.current++));
      setInstructions(
        insertIntoContainer(
          instructions,
          addingAt.containerId,
          newInstr,
          addingAt.index,
        ),
      );
      setAddingAt(null);
      resetForm();
    }
  }

  function startAdd(containerId: string, index: number) {
    setAddingAt({ containerId, index });
    setEditingId(null);
    resetForm();
    setTimeout(() => actionRef.current?.focus(), 0);
  }

  function startEdit(instr: Instruction) {
    loadIntoForm(instr);
    setEditingId(instr.id);
    setAddingAt(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function cancelAdd() {
    setAddingAt(null);
  }

  function remove(id: InstructionId) {
    const [newTree] = removeFromTree(instructions, id);
    setInstructions(newTree);
    if (editingId === id) setEditingId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const srcContainer =
      (active.data.current?.sortable?.containerId as string) ?? "top";
    const overSortableContainer = over.data.current?.sortable?.containerId as
      | string
      | undefined;
    const destContainer = overSortableContainer ?? String(over.id);

    if (active.id === over.id) return;

    if (srcContainer === destContainer && overSortableContainer) {
      const items = getContainerItems(instructions, srcContainer);
      if (!items) return;
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setInstructions(
          reorderInContainer(instructions, srcContainer, oldIndex, newIndex),
        );
      }
      return;
    }

    const draggedId = active.id as InstructionId;
    const draggedInstr = findInstructionById(instructions, draggedId);
    if (!draggedInstr) return;

    const destParsed = parseContainerId(destContainer);

    if (
      destParsed.type === "split" &&
      (draggedInstr.type === "group" || draggedInstr.type === "split")
    )
      return;

    if (
      destParsed.type === "group" &&
      instructionContainsId(draggedInstr, destParsed.groupId)
    )
      return;
    if (
      destParsed.type === "split" &&
      instructionContainsId(draggedInstr, destParsed.splitId)
    )
      return;

    const [treeWithout, removed] = removeFromTree(instructions, draggedId);
    if (!removed) return;

    let insertIdx: number;
    if (overSortableContainer) {
      const destItems = getContainerItems(treeWithout, destContainer);
      const overIdx = destItems
        ? destItems.findIndex((i) => i.id === over.id)
        : -1;
      insertIdx = overIdx !== -1 ? overIdx : (destItems?.length ?? 0);
    } else {
      insertIdx = getContainerItems(treeWithout, destContainer)?.length ?? 0;
    }

    setInstructions(
      insertIntoContainer(treeWithout, destContainer, removed, insertIdx),
    );
    if (editingId === draggedId) {
      setEditingId(null);
    }
    setAddingAt(null);
  }

  function copyJson() {
    const dance = DanceSchema.parse({
      initFormation: "improper",
      instructions,
    });
    navigator.clipboard.writeText(JSON.stringify(dance, null, 2));
    setCopyFeedback("Copied!");
    setTimeout(() => setCopyFeedback(""), 1500);
  }

  function tryLoadJson(text: string) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    const result = DanceSchema.safeParse(json);
    if (!result.success) {
      alert(
        `Invalid dance JSON:\n${result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`,
      );
      return;
    }
    const dance = result.data;
    setInstructions(dance.instructions);
    nextNonce.current = maxInstructionNonce(dance.instructions) + 1;
    setEditingId(null);
    setAddingAt(null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function renderInstructionForm(mode: "add" | "edit", atomicOnly: boolean) {
    const actionOptions = atomicOnly
      ? ACTION_OPTIONS.filter((o) => o !== "split" && o !== "group")
      : (ACTION_OPTIONS as string[]);

    return (
      <div className="inline-form">
        <label>
          Action
          <SearchableDropdown
            ref={actionRef}
            options={actionOptions}
            value={action ?? ""}
            onChange={(v) => {
              const a = v as ActionType | "split" | "group";
              setAction(a);
              if (editingId === null) setBeats(defaultBeats(a));
            }}
            getLabel={(v) =>
              ACTION_LABELS[v as keyof typeof ACTION_LABELS] ?? v
            }
            placeholder="Select action..."
          />
        </label>

        {action !== null && (
          <>
            {action === "split" && (
              <label>
                Split by
                <SearchableDropdown
                  options={SPLIT_BY_OPTIONS}
                  value={splitBy}
                  onChange={(v) => setSplitBy(v as SplitBy)}
                  getLabel={(v) =>
                    SPLIT_BY_LABELS[v as keyof typeof SPLIT_BY_LABELS]
                  }
                />
              </label>
            )}

            {action === "group" && (
              <label>
                Label
                <input
                  type="text"
                  value={groupLabel}
                  onChange={(e) => setGroupLabel(e.target.value)}
                  placeholder="e.g. Allemande figure"
                />
              </label>
            )}

            {action !== "split" &&
              action !== "group" &&
              (action === "take_hands" ||
                action === "allemande" ||
                action === "do_si_do" ||
                action === "pull_by") && (
                <label>
                  With
                  <SearchableDropdown
                    options={RELATIONSHIP_OPTIONS as string[]}
                    value={relationship}
                    onChange={(v) => setRelationship(v as Relationship)}
                    getLabel={(v) =>
                      RELATIONSHIP_LABELS[v as keyof typeof RELATIONSHIP_LABELS]
                    }
                  />
                </label>
              )}

            {action === "drop_hands" && (
              <label>
                Drop
                <SearchableDropdown
                  options={DROP_TARGET_OPTIONS as string[]}
                  value={dropTarget}
                  onChange={(v) => setDropTarget(v as DropHandsTarget)}
                  getLabel={(v) =>
                    DROP_TARGET_LABELS[v as keyof typeof DROP_TARGET_LABELS]
                  }
                />
              </label>
            )}

            {(action === "take_hands" || action === "pull_by") && (
              <label>
                Hand
                <SearchableDropdown
                  options={
                    action === "take_hands"
                      ? TAKE_HANDS_HAND_OPTIONS
                      : HAND_OPTIONS
                  }
                  value={hand}
                  onChange={(v) => setHand(v as "left" | "right" | "inside")}
                />
              </label>
            )}

            {action === "allemande" && (
              <>
                <label>
                  Hand
                  <SearchableDropdown
                    options={HAND_OPTIONS}
                    value={handedness}
                    onChange={(v) => setHandedness(v as "left" | "right")}
                  />
                </label>
                <label>
                  Rotations
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rotations}
                    onChange={(e) => setRotations(e.target.value)}
                  />
                </label>
              </>
            )}

            {action === "do_si_do" && (
              <label>
                Rotations
                <input
                  type="text"
                  inputMode="decimal"
                  value={rotations}
                  onChange={(e) => setRotations(e.target.value)}
                />
              </label>
            )}

            {action === "circle" && (
              <>
                <label>
                  Direction
                  <SearchableDropdown
                    options={CIRCLE_DIR_OPTIONS}
                    value={handedness}
                    onChange={(v) => setHandedness(v as "left" | "right")}
                  />
                </label>
                <label>
                  Rotations
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rotations}
                    onChange={(e) => setRotations(e.target.value)}
                  />
                </label>
              </>
            )}

            {action === "turn" && (
              <>
                <label>
                  Target
                  <SearchableDropdown
                    options={DIR_OPTIONS}
                    value={turnText}
                    onChange={setTurnText}
                    placeholder="e.g. across, partner"
                  />
                </label>
                <label>
                  Offset
                  <input
                    type="text"
                    inputMode="decimal"
                    value={turnOffset}
                    onChange={(e) => setTurnOffset(e.target.value)}
                  />
                </label>
              </>
            )}

            {action === "step" && (
              <>
                <label>
                  Direction
                  <SearchableDropdown
                    options={DIR_OPTIONS}
                    value={stepText}
                    onChange={setStepText}
                    placeholder="e.g. across, partner, 45"
                  />
                </label>
                <label>
                  Distance
                  <input
                    type="text"
                    inputMode="decimal"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                  />
                </label>
              </>
            )}

            {action === "balance" && (
              <>
                <label>
                  Direction
                  <SearchableDropdown
                    options={DIR_OPTIONS}
                    value={balanceText}
                    onChange={setBalanceText}
                    placeholder="e.g. across, partner, 45"
                  />
                </label>
                <label>
                  Distance
                  <input
                    type="text"
                    inputMode="decimal"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                  />
                </label>
              </>
            )}

            {action !== "split" &&
              action !== "take_hands" &&
              action !== "drop_hands" && (
                <label>
                  Beats
                  <input
                    type="text"
                    inputMode="decimal"
                    value={beats}
                    onChange={(e) => setBeats(e.target.value)}
                  />
                </label>
              )}

            <div className="builder-buttons">
              <button className="add-btn" onClick={add}>
                {mode === "edit" ? "Save" : "Add"}
              </button>
              <button
                className="cancel-btn"
                onClick={mode === "edit" ? cancelEdit : cancelAdd}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {action === null && (
          <div className="builder-buttons">
            <button
              className="cancel-btn"
              onClick={mode === "edit" ? cancelEdit : cancelAdd}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderPlusRow(containerId: string, index: number) {
    return (
      <div className="add-button-row">
        <button
          className="add-between-btn"
          onClick={() => startAdd(containerId, index)}
          title="Insert instruction"
        >
          +
        </button>
      </div>
    );
  }

  function renderAddFormIfNeeded(
    containerId: string,
    index: number,
    atomicOnly: boolean,
  ) {
    if (
      addingAt &&
      addingAt.containerId === containerId &&
      addingAt.index === index
    ) {
      return renderInstructionForm("add", atomicOnly);
    }
    return null;
  }

  return (
    <div className="command-pane">
      <h2>Instructions</h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="instruction-list">
          <SortableContext
            id="top"
            items={instructions.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {renderPlusRow("top", 0)}
            {renderAddFormIfNeeded("top", 0, false)}
            {instructions.map((instr, idx) => (
              <SortableItem key={instr.id} id={instr.id}>
                {(dragHandleProps) => (
                  <>
                    {editingId === instr.id ? (
                      renderInstructionForm("edit", false)
                    ) : (
                      <>
                        <div
                          className={`instruction-item${instr.id === activeId ? " active" : ""}`}
                        >
                          <span className="drag-handle" {...dragHandleProps}>
                            {"\u2630"}
                          </span>
                          <span className="instruction-summary">
                            {summarize(instr)}
                          </span>
                          <div className="instruction-actions">
                            <button
                              onClick={() => startEdit(instr)}
                              title="Edit"
                            >
                              {"\u270E"}
                            </button>
                            <button
                              onClick={() => remove(instr.id)}
                              title="Delete"
                            >
                              {"\u00D7"}
                            </button>
                          </div>
                        </div>
                        {warnings.get(instr.id) && (
                          <div className="instruction-warning">
                            {warnings.get(instr.id)}
                          </div>
                        )}
                        {instr.type === "split" && renderSplitBody(instr)}
                        {instr.type === "group" && renderGroupBody(instr)}
                      </>
                    )}
                    {renderPlusRow("top", idx + 1)}
                    {renderAddFormIfNeeded("top", idx + 1, false)}
                  </>
                )}
              </SortableItem>
            ))}
          </SortableContext>
          <DropZone containerId="top" />
          {instructions.length === 0 && (
            <div className="instruction-empty">
              No instructions yet. Click + to add one.
            </div>
          )}
        </div>

        <div className="json-io">
          <button onClick={copyJson}>{copyFeedback || "Copy JSON"}</button>
          <textarea
            value=""
            onChange={() => {}}
            onPaste={(e) => {
              e.preventDefault();
              const text = e.clipboardData.getData("text");
              tryLoadJson(text);
            }}
            placeholder="Paste JSON here to load"
            rows={3}
          />
        </div>
      </DndContext>
    </div>
  );

  function renderGroupBody(group: Extract<Instruction, { type: "group" }>) {
    const containerId = `group-${group.id}`;
    return (
      <div className="group-body">
        <SortableContext
          id={containerId}
          items={group.instructions.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {renderPlusRow(containerId, 0)}
          {renderAddFormIfNeeded(containerId, 0, false)}
          {group.instructions.map((child, idx) => (
            <SortableItem key={child.id} id={child.id}>
              {(dragHandleProps) => (
                <>
                  {editingId === child.id ? (
                    renderInstructionForm("edit", false)
                  ) : (
                    <>
                      <div
                        className={`instruction-item group-child-item${child.id === activeId ? " active" : ""}`}
                      >
                        <span className="drag-handle" {...dragHandleProps}>
                          {"\u2630"}
                        </span>
                        <span className="instruction-summary">
                          {summarize(child)}
                        </span>
                        <div className="instruction-actions">
                          <button onClick={() => startEdit(child)} title="Edit">
                            {"\u270E"}
                          </button>
                          <button
                            onClick={() => remove(child.id)}
                            title="Delete"
                          >
                            {"\u00D7"}
                          </button>
                        </div>
                      </div>
                      {warnings.get(child.id) && (
                        <div className="instruction-warning">
                          {warnings.get(child.id)}
                        </div>
                      )}
                      {child.type === "split" && renderSplitBody(child)}
                      {child.type === "group" && renderGroupBody(child)}
                    </>
                  )}
                  {renderPlusRow(containerId, idx + 1)}
                  {renderAddFormIfNeeded(containerId, idx + 1, false)}
                </>
              )}
            </SortableItem>
          ))}
        </SortableContext>
        <DropZone containerId={containerId} />
      </div>
    );
  }

  function renderSplitBody(split: SplitInstruction) {
    const [first, second] = splitLists(split);
    return (
      <div className="split-body">
        {(["first", "second"] as const).map((list) => {
          const subList = list === "first" ? first : second;
          const label = splitGroupLabel(split.by, list);
          const containerId = `split-${split.id}-${list}`;
          return (
            <div key={list} className="split-group">
              <div className="split-group-header">{label}:</div>
              <SortableContext
                id={containerId}
                items={subList.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {renderPlusRow(containerId, 0)}
                {renderAddFormIfNeeded(containerId, 0, true)}
                {subList.map((sub, idx) => (
                  <SortableItem key={sub.id} id={sub.id}>
                    {(dragHandleProps) => (
                      <>
                        {editingId === sub.id ? (
                          renderInstructionForm("edit", true)
                        ) : (
                          <>
                            <div className={`instruction-item split-sub-item`}>
                              <span
                                className="drag-handle"
                                {...dragHandleProps}
                              >
                                {"\u2630"}
                              </span>
                              <span className="instruction-summary">
                                {summarizeAtomic(sub)}
                              </span>
                              <div className="instruction-actions">
                                <button
                                  onClick={() => startEdit(sub)}
                                  title="Edit"
                                >
                                  {"\u270E"}
                                </button>
                                <button
                                  onClick={() => remove(sub.id)}
                                  title="Delete"
                                >
                                  {"\u00D7"}
                                </button>
                              </div>
                            </div>
                            {warnings.get(sub.id) && (
                              <div className="instruction-warning">
                                {warnings.get(sub.id)}
                              </div>
                            )}
                          </>
                        )}
                        {renderPlusRow(containerId, idx + 1)}
                        {renderAddFormIfNeeded(containerId, idx + 1, true)}
                      </>
                    )}
                  </SortableItem>
                ))}
              </SortableContext>
              <DropZone containerId={containerId} />
            </div>
          );
        })}
      </div>
    );
  }
}
