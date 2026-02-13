#!/usr/bin/env npx tsx
import { readFileSync } from 'node:fs';
import type { Dance, ProtoDancerId } from '../src/types.ts';
import { generateAllKeyframes, validateHandDistances, validateHandSymmetry } from '../src/generate.ts';

const input = readFileSync(process.stdin.fd, 'utf-8');
const dance: Dance = JSON.parse(input);
const kfs = generateAllKeyframes(dance.instructions);
const last = kfs[kfs.length - 1];

// Column widths
const nameW = 12;
const numW = 8;
const handW = 20;

console.log(`\n=== Final state (beat ${last.beat}) ===\n`);

// Dancer positions table
console.log('Dancer positions:');
console.log(
  '  ' +
  'Dancer'.padEnd(nameW) +
  'x'.padStart(numW) +
  'y'.padStart(numW) +
  'facing'.padStart(numW)
);
console.log('  ' + '-'.repeat(nameW + numW * 3));
for (const [id, d] of Object.entries(last.dancers)) {
  console.log(
    '  ' +
    id.padEnd(nameW) +
    d.x.toFixed(4).padStart(numW) +
    d.y.toFixed(4).padStart(numW) +
    (d.facing.toFixed(1) + '\u00B0').padStart(numW)
  );
}

console.log('\nHand connections:');
const protoIds: ProtoDancerId[] = ['up_lark', 'up_robin', 'down_lark', 'down_robin'];
const seen = new Set<string>();
const connections: { a: string; ha: string; b: string; hb: string }[] = [];
for (const id of protoIds) {
  for (const side of ['left', 'right'] as ('left' | 'right')[]) {
    const target = last.hands[id][side];
    if (!target) continue;
    const [targetId, targetSide] = target;
    const aKey = `${id}_0`;
    const key = aKey < targetId ? `${aKey}:${side}:${targetId}:${targetSide}` : `${targetId}:${targetSide}:${aKey}:${side}`;
    if (seen.has(key)) continue;
    seen.add(key);
    connections.push({ a: `${id}_0`, ha: side, b: targetId, hb: targetSide });
  }
}
if (connections.length === 0) {
  console.log('  (none)');
} else {
  console.log(
    '  ' +
    'A'.padEnd(handW) +
    'hand'.padEnd(numW) +
    'B'.padEnd(handW) +
    'hand'.padEnd(numW)
  );
  console.log('  ' + '-'.repeat(handW * 2 + numW * 2));
  for (const h of connections) {
    console.log(
      '  ' +
      h.a.padEnd(handW) +
      h.ha.padEnd(numW) +
      h.b.padEnd(handW) +
      h.hb.padEnd(numW)
    );
  }
}

// Validation warnings
const distWarnings = validateHandDistances(dance.instructions, kfs);
const symmetryErrors = validateHandSymmetry(kfs);
if (distWarnings.size > 0 || symmetryErrors.length > 0) {
  console.log('\nWarnings:');
  for (const [id, msg] of distWarnings) {
    console.log(`  [instruction ${id}] ${msg}`);
  }
  for (const msg of symmetryErrors) {
    console.log(`  [symmetry] ${msg}`);
  }
}
console.log();
