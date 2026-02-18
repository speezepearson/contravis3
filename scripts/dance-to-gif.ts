/**
 * CLI script: convert a dance JSON file to an animated GIF.
 *
 * Usage:
 *   npx tsx scripts/dance-to-gif.ts <dance.json> [output.gif]
 *
 * Requires the `canvas` npm package (dev dependency).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createCanvas } from 'canvas';
import { DanceSchema } from '../src/types';
import { generateAllKeyframes } from '../src/generate';
import { exportGif } from '../src/exportGif';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: npx tsx scripts/dance-to-gif.ts <dance.json> [output.gif]');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] ?? inputFile.replace(/\.json$/, '.gif');

const danceJson: unknown = JSON.parse(readFileSync(inputFile, 'utf-8'));
const dance = DanceSchema.parse(danceJson);

const { keyframes, error } = generateAllKeyframes(dance.instructions, dance.initFormation);
if (error) {
  console.error(`Generation error: ${error}`);
  process.exit(1);
}

if (keyframes.length === 0) {
  console.error('No keyframes generated (dance has no instructions?)');
  process.exit(1);
}

const width = 400;
const height = 600;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

const gifBytes = exportGif(keyframes, ctx, { width, height });

writeFileSync(outputFile, gifBytes);
const totalBeats = keyframes[keyframes.length - 1].beat - keyframes[0].beat;
console.log(`Wrote ${outputFile} (${(gifBytes.length / 1024).toFixed(0)} KB, ${totalBeats} beats)`);
