/**
 * Generate GIF files for the three new figure demos.
 * Run with: npx tsx demos/new-figures/generate-gifs.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from 'canvas';
import { DanceSchema } from '../../src/types';
import { generateAllKeyframes } from '../../src/generate';
import { exportGif } from '../../src/exportGif';

const __dirname = dirname(fileURLToPath(import.meta.url));

const demos = [
  { file: 'short-waves-dance.json', output: 'short-waves.gif' },
  { file: 'long-waves-dance.json', output: 'long-waves.gif' },
  { file: 'long-lines-dance.json', output: 'long-lines.gif' },
];

for (const demo of demos) {
  const jsonPath = resolve(__dirname, demo.file);
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const dance = DanceSchema.parse(raw);

  const { keyframes, error } = generateAllKeyframes(dance.instructions, dance.initFormation);
  if (error) {
    console.error(`Error generating ${demo.file}: ${error.message}`);
    continue;
  }

  const width = 400;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

  const gifBytes = exportGif(keyframes, ctx, {
    width,
    height,
    fps: 15,
    bpm: 120,
    smoothness: 1,
    progression: dance.progression,
    progressionRate: -dance.progression / 64,
    wrap: false,
  });

  const outPath = resolve(__dirname, demo.output);
  writeFileSync(outPath, Buffer.from(gifBytes.buffer as ArrayBuffer));
  console.log(`Wrote ${outPath} (${gifBytes.length} bytes)`);
}
