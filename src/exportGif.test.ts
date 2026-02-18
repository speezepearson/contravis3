import { describe, it, expect } from 'vitest';
import { encodeGifFromFrames } from './exportGif';

function makeFrame(width: number, height: number, r: number, g: number, b: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

describe('encodeGifFromFrames', () => {
  it('throws on empty frames', () => {
    expect(() => encodeGifFromFrames([], 100)).toThrow('No frames to encode');
  });

  it('produces valid GIF89a output for a single frame', () => {
    const gif = encodeGifFromFrames([makeFrame(4, 4, 255, 0, 0)], 100);

    // GIF89a magic bytes
    expect(gif[0]).toBe(0x47); // G
    expect(gif[1]).toBe(0x49); // I
    expect(gif[2]).toBe(0x46); // F
    expect(gif[3]).toBe(0x38); // 8
    expect(gif[4]).toBe(0x39); // 9
    expect(gif[5]).toBe(0x61); // a

    // GIF trailer byte
    expect(gif[gif.length - 1]).toBe(0x3b);
  });

  it('produces output for multiple frames', () => {
    const frames = [
      makeFrame(8, 8, 255, 0, 0),
      makeFrame(8, 8, 0, 255, 0),
      makeFrame(8, 8, 0, 0, 255),
    ];

    const gif = encodeGifFromFrames(frames, 67);
    expect(gif[0]).toBe(0x47); // G
    expect(gif.length).toBeGreaterThan(100);
    expect(gif[gif.length - 1]).toBe(0x3b); // trailer
  });

  it('output grows with more frames', () => {
    const oneFrame = encodeGifFromFrames([makeFrame(8, 8, 255, 0, 0)], 100);
    const threeFrames = encodeGifFromFrames([
      makeFrame(8, 8, 255, 0, 0),
      makeFrame(8, 8, 0, 255, 0),
      makeFrame(8, 8, 0, 0, 255),
    ], 100);

    expect(threeFrames.length).toBeGreaterThan(oneFrame.length);
  });
});
