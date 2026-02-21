/**
 * CLI tool for building contra dance JSON files.
 * Run with --help for usage information.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  DanceSchema, InstructionSchema, InstructionIdSchema,
  type Dance, type Instruction, type Keyframe, type ProtoDancerId, type DancerId, type HandConnection, type DancerState, type InstructionId,
  ProtoDancerIdSchema, dancerPosition, parseDancerId, makeDancerId, instructionDuration,
  NORTH, EAST, SOUTH, WEST, headingAngle,
} from '../src/types';
import { Vector } from 'vecti';
import { generateAllKeyframes, validateHandDistances, validateProgression, type GenerateError } from '../src/generate';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInstructionId(): string {
  return InstructionIdSchema.parse(randomUUID());
}

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function readDance(path: string): Dance {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  return DanceSchema.parse(raw);
}

function writeDance(path: string, dance: Dance): void {
  writeFileSync(path, JSON.stringify(dance, null, 2) + '\n');
}

/** Walk the instruction tree, calling fn on each node (pre-order). */
function walkInstructions(instrs: Instruction[], fn: (instr: Instruction, depth: number, parent: Instruction | null) => void, depth = 0, parent: Instruction | null = null): void {
  for (const instr of instrs) {
    fn(instr, depth, parent);
    if (instr.type === 'group') {
      walkInstructions(instr.instructions, fn, depth + 1, instr);
    } else if (instr.type === 'split') {
      const subs = instr.by === 'role' ? [...instr.larks, ...instr.robins] : [...instr.ups, ...instr.downs];
      for (const s of subs) fn(s, depth + 1, instr);
    }
  }
}

/** Find an instruction by id, returning [parentList, index]. */
function findInstruction(instrs: Instruction[], id: string): { list: Instruction[]; index: number } | null {
  for (let i = 0; i < instrs.length; i++) {
    if (instrs[i].id === id) return { list: instrs, index: i };
    const instr = instrs[i];
    if (instr.type === 'group') {
      const found = findInstruction(instr.instructions, id);
      if (found) return found;
    }
    // For splits, search within sub-lists
    if (instr.type === 'split') {
      if (instr.by === 'role') {
        for (const sub of [instr.larks, instr.robins]) {
          for (let j = 0; j < sub.length; j++) {
            if (sub[j].id === id) return { list: sub as unknown as Instruction[], index: j };
          }
        }
      } else {
        for (const sub of [instr.ups, instr.downs]) {
          for (let j = 0; j < sub.length; j++) {
            if (sub[j].id === id) return { list: sub as unknown as Instruction[], index: j };
          }
        }
      }
    }
  }
  return null;
}

/** Compute cumulative beat at which each instruction ID starts. */
function computeBeatMap(instrs: Instruction[]): Map<string, number> {
  const map = new Map<string, number>();
  let beat = 0;
  function walk(instructions: Instruction[]) {
    for (const instr of instructions) {
      map.set(instr.id, beat);
      if (instr.type === 'group') {
        walk(instr.instructions);
      } else if (instr.type === 'split') {
        // For splits, the sub-instructions start at the same beat
        const subBeat = beat;
        if (instr.by === 'role') {
          let b = subBeat;
          for (const s of instr.larks) { map.set(s.id, b); b += s.beats; }
          b = subBeat;
          for (const s of instr.robins) { map.set(s.id, b); b += s.beats; }
        } else {
          let b = subBeat;
          for (const s of instr.ups) { map.set(s.id, b); b += s.beats; }
          b = subBeat;
          for (const s of instr.downs) { map.set(s.id, b); b += s.beats; }
        }
        beat += instructionDuration(instr);
      } else {
        beat += instr.beats;
      }
    }
  }
  walk(instrs);
  return map;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

const PROTO_IDS = ProtoDancerIdSchema.options;

function facingStr(facing: Vector): string {
  const EPS = 0.02; // ~1° in component space
  if (facing.subtract(NORTH).length() < EPS) return 'up (0 rot)';
  if (facing.subtract(EAST).length() < EPS) return 'across-right (0.25 rot)';
  if (facing.subtract(SOUTH).length() < EPS) return 'down (0.5 rot)';
  if (facing.subtract(WEST).length() < EPS) return 'across-left (0.75 rot)';
  const rad = headingAngle(facing);
  const normalized = ((rad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return `${(normalized / (2 * Math.PI)).toFixed(2)} rot`;
}

function handStr(h: HandConnection, perspective: DancerId): string {
  const isA = h.a === perspective;
  const myHand = isA ? h.ha : h.hb;
  const theirHand = isA ? h.hb : h.ha;
  const theirId = isA ? h.b : h.a;
  return `my ${myHand} ↔ ${theirId}'s ${theirHand}`;
}

function neighborInfo(
  label: string,
  _myId: ProtoDancerId,
  myState: DancerState,
  others: { id: DancerId; state: DancerState }[],
  searchDir: Vector, // unit vector direction to search
): string {
  let best: { id: DancerId; dist: number; headingRot: number; bearingRot: number } | null = null;
  let bestScore = Infinity;
  const TAU = 2 * Math.PI;

  for (const o of others) {
    const delta = o.state.pos.subtract(myState.pos);
    const dist = delta.length();
    if (dist < 0.01) continue;
    const cosTheta = (searchDir.x * delta.x + searchDir.y * delta.y) / dist;
    if (cosTheta < 0.3) continue; // must be roughly in that direction
    const score = dist / Math.max(cosTheta, 0.01);
    if (score < bestScore) {
      bestScore = score;
      const headingRad = Math.atan2(delta.x, delta.y);
      const normalizedHeading = ((headingRad % TAU) + TAU) % TAU;
      const myFacingRad = headingAngle(myState.facing);
      const bearingRad = ((headingRad - myFacingRad + 3 * Math.PI) % TAU) - Math.PI;
      best = { id: o.id, dist, headingRot: normalizedHeading / TAU, bearingRot: bearingRad / TAU };
    }
  }

  if (!best) return `  ${label}: (none)`;
  return `  ${label}: ${best.id}  dist=${best.dist.toFixed(2)}m  heading=${best.headingRot.toFixed(2)} rot  bearing=${best.bearingRot > 0 ? '+' : ''}${best.bearingRot.toFixed(2)} rot`;
}

function formatKeyframe(kf: Keyframe): string {
  const lines: string[] = [];
  lines.push(`── Beat ${kf.beat} ──`);

  for (const protoId of PROTO_IDS) {
    const d = kf.dancers[protoId];
    const dancerId = makeDancerId(protoId, 0);
    lines.push(`${protoId}:`);
    lines.push(`  pos: (${d.pos.x.toFixed(3)}, ${d.pos.y.toFixed(3)})  facing: ${facingStr(d.facing)}`);

    // Hand connections
    const myHands = kf.hands.filter(h => h.a === dancerId || h.b === dancerId);
    if (myHands.length > 0) {
      lines.push(`  hands: ${myHands.map(h => handStr(h, dancerId)).join('; ')}`);
    } else {
      lines.push(`  hands: (none)`);
    }

    // Build list of nearby dancers (all protos at offsets -1, 0, 1)
    const others: { id: DancerId; state: DancerState }[] = [];
    for (const otherId of PROTO_IDS) {
      for (const offset of [-1, 0, 1]) {
        if (otherId === protoId && offset === 0) continue;
        const did = makeDancerId(otherId, offset);
        others.push({ id: did, state: dancerPosition(did, kf.dancers) });
      }
    }

    // on left, on right, in front (relative to facing)
    const f = d.facing;
    // left = 90° CCW from facing: (-facing.y, facing.x)
    lines.push(neighborInfo('on left', protoId, d, others, new Vector(-f.y, f.x)));
    // right = 90° CW from facing: (facing.y, -facing.x)
    lines.push(neighborInfo('on right', protoId, d, others, new Vector(f.y, -f.x)));
    lines.push(neighborInfo('in front', protoId, d, others, f));
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Subcommands ────────────────────────────────────────────────────────────

function cmdInit(args: string[]): void {
  let path = '';
  let initFormation: 'improper' | 'beckett' = 'improper';
  let progression = 1;
  let name: string | undefined;
  let author: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--initFormation') { initFormation = args[++i] as 'improper' | 'beckett'; }
    else if (arg === '--progression') { progression = parseInt(args[++i]); }
    else if (arg === '--name') { name = args[++i]; }
    else if (arg === '--author') { author = args[++i]; }
    else if (!path) { path = arg; }
    else die(`Unexpected argument: ${arg}`);
    i++;
  }

  if (!path) die('Usage: choreo init PATH --initFormation FORM --progression N [--name NAME] [--author AUTHOR]');

  const dance: Dance = {
    ...(name ? { name } : {}),
    ...(author ? { author } : {}),
    initFormation,
    progression,
    instructions: [],
  } as Dance;

  writeDance(path, dance);
  console.log(`Created ${path} (${initFormation}, progression ${progression})`);
}

function cmdInsert(args: string[]): void {
  let path = '';
  let jsonStr = '';
  let beforeId: string | undefined;
  let afterId: string | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--before') { beforeId = args[++i]; }
    else if (arg === '--after') { afterId = args[++i]; }
    else if (!path) { path = arg; }
    else if (!jsonStr) { jsonStr = arg; }
    else die(`Unexpected argument: ${arg}`);
    i++;
  }

  if (!path || !jsonStr) die('Usage: choreo insert PATH \'{...json...}\' [--before ID | --after ID]');

  const dance = readDance(path);

  // Parse the instruction JSON, injecting a UUID if not present
  const raw = JSON.parse(jsonStr);
  if (!raw.id) {
    raw.id = makeInstructionId();
  }

  // Validate as instruction
  const instr = InstructionSchema.parse(raw);

  if (beforeId) {
    const found = findInstruction(dance.instructions, beforeId);
    if (!found) die(`Instruction ID not found: ${beforeId}`);
    found.list.splice(found.index, 0, instr);
  } else if (afterId) {
    const found = findInstruction(dance.instructions, afterId);
    if (!found) die(`Instruction ID not found: ${afterId}`);
    found.list.splice(found.index + 1, 0, instr);
  } else {
    dance.instructions.push(instr);
  }

  writeDance(path, dance);
  console.log(`Inserted instruction ${instr.id} (type: ${instr.type})`);

  // Run a quick inspect to show the state after this instruction
  try {
    const { keyframes, error } = generateAllKeyframes(dance.instructions, dance.initFormation);
    if (error) {
      console.log(`\n⚠ Generation error at instruction ${error.instructionId}: ${error.message}`);
    }
    if (keyframes.length > 0) {
      const lastKf = keyframes[keyframes.length - 1];
      console.log(`\nState after (beat ${lastKf.beat}):`);
      console.log(formatKeyframe(lastKf));
    }
  } catch (e) {
    console.log(`\n⚠ Could not generate keyframes: ${e instanceof Error ? e.message : e}`);
  }
}

function cmdInspect(args: string[]): void {
  let path = '';
  let beforeId: string | undefined;
  let afterId: string | undefined;
  let timeBeat: number | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--before') { beforeId = args[++i]; }
    else if (arg === '--after') { afterId = args[++i]; }
    else if (arg === '--time') { timeBeat = parseFloat(args[++i]); }
    else if (!path) { path = arg; }
    else die(`Unexpected argument: ${arg}`);
    i++;
  }

  if (!path) die('Usage: choreo inspect PATH [--before ID | --after ID | --time BEATS]');

  const dance = readDance(path);
  const beatMap = computeBeatMap(dance.instructions);

  // Determine the target beat
  let targetBeat: number | undefined;
  if (timeBeat !== undefined) {
    targetBeat = timeBeat;
  } else if (beforeId) {
    const b = beatMap.get(beforeId);
    if (b === undefined) die(`Instruction ID not found: ${beforeId}`);
    targetBeat = b;
  } else if (afterId) {
    const b = beatMap.get(afterId);
    if (b === undefined) die(`Instruction ID not found: ${afterId}`);
    // Find the instruction to get its duration
    let dur = 0;
    walkInstructions(dance.instructions, (instr) => {
      if (instr.id === afterId) dur = instructionDuration(instr);
    });
    targetBeat = b + dur;
  }

  // Generate keyframes
  const { keyframes, error } = generateAllKeyframes(dance.instructions, dance.initFormation);

  // Filter keyframes up to target beat
  let relevantKeyframes = keyframes;
  if (targetBeat !== undefined) {
    relevantKeyframes = keyframes.filter(kf => kf.beat <= targetBeat + 1e-9);
  }

  // Show warnings
  const warnings = validateHandDistances(dance.instructions, relevantKeyframes);
  if (warnings.size > 0) {
    console.log('Warnings:');
    for (const [id, msg] of warnings) {
      const beat = beatMap.get(id);
      console.log(`  [${id}] (beat ${beat ?? '?'}): ${msg}`);
    }
    console.log('');
  }

  // Show error if it's within our target time
  if (error) {
    const errorBeat = beatMap.get(error.instructionId);
    if (targetBeat === undefined || (errorBeat !== undefined && errorBeat <= targetBeat)) {
      console.log(`Error at instruction ${error.instructionId} (beat ${errorBeat ?? '?'}): ${error.message}\n`);
    }
  }

  // Validate progression if showing the full dance
  if (targetBeat === undefined && keyframes.length > 0) {
    const progError = validateProgression(keyframes, dance.initFormation, dance.progression);
    if (progError) {
      console.log(`Progression warning: ${progError}\n`);
    }
  }

  // Print the last relevant keyframe
  if (relevantKeyframes.length > 0) {
    console.log(formatKeyframe(relevantKeyframes[relevantKeyframes.length - 1]));
  } else {
    console.log('No keyframes to show.');
  }
}

function cmdValidate(args: string[]): void {
  const path = args[0];
  if (!path) die('Usage: choreo validate PATH');

  const dance = readDance(path);
  const { keyframes, error } = generateAllKeyframes(dance.instructions, dance.initFormation);

  let hasIssues = false;

  if (error) {
    console.log(`Generation error at instruction ${error.instructionId}: ${error.message}`);
    hasIssues = true;
  }

  const warnings = validateHandDistances(dance.instructions, keyframes);
  for (const [id, msg] of warnings) {
    console.log(`Warning [${id}]: ${msg}`);
    hasIssues = true;
  }

  if (keyframes.length > 0) {
    const progError = validateProgression(keyframes, dance.initFormation, dance.progression);
    if (progError) {
      console.log(`Progression: ${progError}`);
      hasIssues = true;
    }
  }

  const totalBeats = keyframes.length > 0 ? keyframes[keyframes.length - 1].beat : 0;
  console.log(`\nTotal beats: ${totalBeats}`);
  console.log(`Instructions: ${dance.instructions.length} top-level`);

  if (!hasIssues) {
    console.log('No issues found!');
  }
}

function cmdList(args: string[]): void {
  const path = args[0];
  if (!path) die('Usage: choreo list PATH');

  const dance = readDance(path);
  const beatMap = computeBeatMap(dance.instructions);

  console.log(`${dance.name ?? '(unnamed)'} by ${dance.author ?? '(unknown)'}`);
  console.log(`Formation: ${dance.initFormation}, Progression: ${dance.progression}\n`);

  walkInstructions(dance.instructions, (instr, depth) => {
    const indent = '  '.repeat(depth);
    const beat = beatMap.get(instr.id) ?? '?';
    const dur = instructionDuration(instr);

    if (instr.type === 'group') {
      console.log(`${indent}[beat ${beat}] GROUP "${instr.label}" (${dur} beats)  id=${instr.id}`);
    } else if (instr.type === 'split') {
      console.log(`${indent}[beat ${beat}] SPLIT by ${instr.by} (${dur} beats)  id=${instr.id}`);
    } else {
      const details = summarizeInstruction(instr);
      console.log(`${indent}[beat ${beat}, ${instr.beats}b] ${instr.type} ${details}  id=${instr.id}`);
    }
  });
}

function summarizeInstruction(instr: Instruction): string {
  if (instr.type === 'group' || instr.type === 'split') return '';
  switch (instr.type) {
    case 'take_hands': return `${instr.relationship} ${instr.hand}`;
    case 'drop_hands': return `${instr.target}`;
    case 'allemande': return `${instr.relationship} ${instr.handedness} ${instr.rotations}x`;
    case 'do_si_do': return `${instr.relationship} ${instr.rotations}x`;
    case 'circle': return `${instr.direction} ${instr.rotations}x`;
    case 'pull_by': return `${instr.relationship} ${instr.hand}`;
    case 'turn': return `toward ${JSON.stringify(instr.target)}`;
    case 'step': return `${JSON.stringify(instr.direction)} ${instr.distance}m`;
    case 'balance': return `${JSON.stringify(instr.direction)} ${instr.distance}m`;
    case 'swing': return `${instr.relationship} endFacing=${JSON.stringify(instr.endFacing)}`;
    case 'box_the_gnat': return `${instr.relationship}`;
    case 'give_and_take_into_swing': return `${instr.relationship} ${instr.role}`;
    case 'mad_robin': return `${instr.dir} ${instr.with} ${instr.rotations}x`;
  }
}

// ─── Help ───────────────────────────────────────────────────────────────────

const HELP_TEXT = `\
choreo - Build and manage contra dance JSON files.

Choreo is a CLI tool for constructing contra dances as structured JSON. You
build a dance by initializing a file and then inserting instructions one at a
time. At any point you can inspect the dancer positions, list the instruction
tree, or validate the dance for errors.

Usage:
  choreo <command> [options]

Commands:
  init       Create a new dance file
  insert     Add an instruction to a dance
  inspect    Show dancer positions at a point in the dance
  validate   Check a dance for errors and warnings
  list       Print the instruction tree

Global Options:
  --help, -h   Show this help message (also works after a command name)

init:
  choreo init <file> [options]

  Create a new empty dance JSON file.

  Options:
    --initFormation <form>   Starting formation: "improper" or "beckett"
                             (default: improper)
    --progression <n>        Progression number (default: 1)
    --name <name>            Dance name
    --author <author>        Choreographer name

  Example:
    choreo init my_dance.json --initFormation improper --progression 1 \\
      --name "Monday Night Special" --author "Traditional"

insert:
  choreo insert <file> '<json>' [options]

  Insert an instruction into the dance. The instruction is a JSON object with
  at minimum a "type" and "beats" field. An "id" (UUID) is auto-generated if
  omitted. After inserting, the resulting dancer state is printed.

  Instruction types:
    take_hands, drop_hands, allemande, do_si_do, circle, pull_by, turn,
    step, balance, swing, box_the_gnat, give_and_take_into_swing, mad_robin

  Positioning Options:
    --before <id>   Insert before the instruction with this ID
    --after <id>    Insert after the instruction with this ID
                    (default: append to end)

  Examples:
    choreo insert my_dance.json '{"type":"circle","beats":8,"direction":"left","rotations":1}'
    choreo insert my_dance.json '{"type":"swing","beats":8,"relationship":"neighbor","endFacing":{"kind":"direction","value":"across"}}' --after 550e8400-e29b-41d4-a716-446655440000

inspect:
  choreo inspect <file> [options]

  Generate keyframes and display the dancer positions, facing directions,
  hand connections, and nearby dancers at a specific point in the dance.
  With no positioning option, shows the state after the last instruction.

  Options:
    --before <id>    Show state just before this instruction
    --after <id>     Show state just after this instruction
    --time <beats>   Show state at a specific beat number

  Example:
    choreo inspect my_dance.json --time 16

validate:
  choreo validate <file>

  Check the dance for generation errors, hand-distance warnings, and
  progression correctness. Prints a summary of total beats and instruction
  count.

  Example:
    choreo validate my_dance.json

list:
  choreo list <file>

  Print a hierarchical listing of all instructions with their beat offsets,
  durations, and IDs.

  Example:
    choreo list my_dance.json`;

function showHelp(): void {
  console.log(HELP_TEXT);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const [subcommand, ...subArgs] = process.argv.slice(2);

if (!subcommand || subcommand === '--help' || subcommand === '-h') {
  showHelp();
  process.exit(0);
}

if (subArgs.includes('--help') || subArgs.includes('-h')) {
  showHelp();
  process.exit(0);
}

switch (subcommand) {
  case 'init':     cmdInit(subArgs); break;
  case 'insert':   cmdInsert(subArgs); break;
  case 'inspect':  cmdInspect(subArgs); break;
  case 'validate': cmdValidate(subArgs); break;
  case 'list':     cmdList(subArgs); break;
  default:
    console.error(`Unknown command: ${subcommand}\n`);
    showHelp();
    process.exit(1);
}
