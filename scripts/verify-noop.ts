/**
 * Verify that the current code produces identical keyframes to a reference git ref.
 *
 * Usage:
 *   npx tsx scripts/verify-noop.ts -- <ref>
 *   e.g.: npx tsx scripts/verify-noop.ts -- main
 *
 * Reads example-dances/otters-allemande.json, generates keyframes with both the
 * current code and the code at <ref>, and diffs the results.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DanceSchema, type Keyframe } from '../src/types';
import { generateAllKeyframes } from '../src/generate';

const DANCE_FILE = 'example-dances/otters-allemande.json';
const PRECISION = 6;

// --- Parse args ---

const args = process.argv.slice(2).filter(a => a !== '--');
if (args.length < 1) {
  console.error('Usage: npx tsx scripts/verify-noop.ts -- <ref>');
  process.exit(1);
}
const ref = args[0];

// --- Deterministic keyframe serialization ---

function round(n: number): number {
  return Math.round(n * 10 ** PRECISION) / 10 ** PRECISION;
}

function serializeKeyframes(keyframes: Keyframe[]): string {
  const plain = keyframes.map(kf => ({
    beat: round(kf.beat),
    dancers: Object.fromEntries(
      Object.entries(kf.dancers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, state]) => [id, {
          pos: { x: round(state.pos.x), y: round(state.pos.y) },
          facing: { x: round(state.facing.x), y: round(state.facing.y) },
        }])
    ),
    hands: kf.hands
      .map(h => ({ a: h.a, ha: h.ha, b: h.b, hb: h.hb }))
      .sort((a, b) => `${a.a}:${a.b}`.localeCompare(`${b.a}:${b.b}`)),
    ...(kf.annotation ? { annotation: kf.annotation } : {}),
  }));
  return JSON.stringify(plain, null, 2);
}

// --- Generate keyframes with current code ---

const rootDir = resolve(import.meta.dirname, '..');
const dancePath = join(rootDir, DANCE_FILE);
const danceJson: unknown = JSON.parse(readFileSync(dancePath, 'utf-8'));
const dance = DanceSchema.parse(danceJson);

const { keyframes: currentKeyframes, error } = generateAllKeyframes(dance.instructions, dance.initFormation);
if (error) {
  console.error(`Current code: generation error at ${error.instructionId}: ${error.message}`);
  process.exit(1);
}
const currentSerialized = serializeKeyframes(currentKeyframes);

// --- Create temp worktree at the reference ref ---

const tmpBase = mkdtempSync(join(tmpdir(), 'verify-noop-'));
const worktreePath = join(tmpBase, 'wt');

try {
  execSync(`git worktree add --detach "${worktreePath}" "${ref}"`, { cwd: rootDir, stdio: 'pipe' });
} catch (e) {
  console.error(`Failed to create worktree at ref "${ref}": ${e instanceof Error ? e.message : e}`);
  rmSync(tmpBase, { recursive: true, force: true });
  process.exit(1);
}

try {
  // Symlink node_modules so the worktree can resolve dependencies
  symlinkSync(join(rootDir, 'node_modules'), join(worktreePath, 'node_modules'));

  // Write a dump script into the worktree that generates and serializes keyframes.
  // This runs against the worktree's src/ (the reference code).
  const dumpScript = `
import { readFileSync } from 'node:fs';
import { DanceSchema } from './src/types.ts';
import { generateAllKeyframes } from './src/generate.ts';

const PRECISION = ${PRECISION};
function round(n) { return Math.round(n * 10 ** PRECISION) / 10 ** PRECISION; }

function serializeKeyframes(keyframes) {
  const plain = keyframes.map(kf => ({
    beat: round(kf.beat),
    dancers: Object.fromEntries(
      Object.entries(kf.dancers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, state]) => [id, {
          pos: { x: round(state.pos.x), y: round(state.pos.y) },
          facing: { x: round(state.facing.x), y: round(state.facing.y) },
        }])
    ),
    hands: kf.hands
      .map(h => ({ a: h.a, ha: h.ha, b: h.b, hb: h.hb }))
      .sort((a, b) => \`\${a.a}:\${a.b}\`.localeCompare(\`\${b.a}:\${b.b}\`)),
    ...(kf.annotation ? { annotation: kf.annotation } : {}),
  }));
  return JSON.stringify(plain, null, 2);
}

const dancePath = ${JSON.stringify(dancePath)};
const danceJson = JSON.parse(readFileSync(dancePath, 'utf-8'));
const dance = DanceSchema.parse(danceJson);
const { keyframes, error } = generateAllKeyframes(dance.instructions, dance.initFormation);
if (error) {
  console.error('Reference code: generation error at ' + error.instructionId + ': ' + error.message);
  process.exit(1);
}
process.stdout.write(serializeKeyframes(keyframes));
`;
  writeFileSync(join(worktreePath, '_verify_dump.ts'), dumpScript);

  const tsxBin = join(rootDir, 'node_modules', '.bin', 'tsx');
  const refSerialized = execSync(`"${tsxBin}" _verify_dump.ts`, {
    cwd: worktreePath,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });

  // --- Compare ---

  if (currentSerialized === refSerialized) {
    console.log(`OK: Keyframes match between current code and "${ref}".`);
  } else {
    const fileA = join(tmpBase, 'ref.json');
    const fileB = join(tmpBase, 'current.json');
    writeFileSync(fileA, refSerialized);
    writeFileSync(fileB, currentSerialized);

    console.error(`MISMATCH: Keyframes differ between current code and "${ref}".`);
    try {
      execSync(`diff -u "${fileA}" "${fileB}"`, { encoding: 'utf-8' });
    } catch (e: unknown) {
      // diff exits with 1 when files differ, output is in stdout
      const execErr = e as { stdout?: string };
      if (execErr.stdout) console.error(execErr.stdout);
    }
    process.exit(1);
  }
} finally {
  // Clean up worktree
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, { cwd: rootDir, stdio: 'pipe' });
  } catch {
    // SWALLOW_EXCEPTION: best-effort cleanup; the worktree may already be gone
  }
  rmSync(tmpBase, { recursive: true, force: true });
}
