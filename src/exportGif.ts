import * as _gifencNs from 'gifenc';
import { Renderer, getFrameAtBeat } from './renderer';
import type { Keyframe } from './types';

// gifenc ships CJS. Vite resolves named exports on the namespace directly;
// Node.js ESM wraps the CJS module.exports as .default.
const _g = _gifencNs as Record<string, unknown>;
const { GIFEncoder, quantize, applyPalette } = (
  typeof _g['GIFEncoder'] === 'function' ? _g : _g['default']
) as typeof _gifencNs;

export interface GifExportOptions {
  width: number;
  height: number;
  fps?: number;
  bpm?: number;
  smoothness?: number;
  progressionRate?: number;
  bgColor?: string;
}

const DEFAULT_BG_COLOR = '#0f0f23';

/**
 * Encode an array of raw RGBA frames into a looping GIF.
 */
export function encodeGifFromFrames(
  frames: { data: Uint8ClampedArray; width: number; height: number }[],
  delay: number,
): Uint8Array {
  if (frames.length === 0) throw new Error('No frames to encode');

  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    const { data, width, height } = frames[i];
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay,
      ...(i === 0 ? { repeat: 0 } : {}),
    });
  }

  gif.finish();
  return gif.bytes();
}

/**
 * Render a dance animation to GIF.
 *
 * @param keyframes - Pre-generated keyframes from generateAllKeyframes
 * @param ctx       - A 2D canvas context sized to options.width x options.height
 * @param options   - Rendering parameters (fps, bpm, smoothness, etc.)
 */
export function exportGif(
  keyframes: Keyframe[],
  ctx: CanvasRenderingContext2D,
  options: GifExportOptions,
): Uint8Array {
  if (keyframes.length === 0) throw new Error('No keyframes to export');

  const {
    width,
    height,
    fps = 15,
    bpm = 120,
    smoothness = 1,
    progressionRate = -1 / 64,
    bgColor = DEFAULT_BG_COLOR,
  } = options;

  const minBeat = keyframes[0].beat;
  const maxBeat = keyframes[keyframes.length - 1].beat;
  const beatsPerSecond = bpm / 60;
  const beatStep = beatsPerSecond / fps;
  const delayMs = Math.round(1000 / fps);

  const renderer = new Renderer(ctx, width, height);

  const frames: { data: Uint8ClampedArray; width: number; height: number }[] = [];

  for (let beat = minBeat; beat <= maxBeat + beatStep / 2; beat += beatStep) {
    const clampedBeat = Math.min(beat, maxBeat);
    const frame = getFrameAtBeat(keyframes, clampedBeat, smoothness);
    if (!frame) continue;

    renderer.drawFrame(frame, progressionRate);

    // drawFrame clears to transparent then draws content on top.
    // Fill background behind the rendered content.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    frames.push({ data: ctx.getImageData(0, 0, width, height).data, width, height });
  }

  return encodeGifFromFrames(frames, delayMs);
}
