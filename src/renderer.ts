import type { DancerState, Keyframe, ProtoDancerId } from './types';
import { Vector, dancerPosition, ProtoDancerIdSchema, buildDancerRecord, FULL_CW } from './types';

const COLORS: Record<ProtoDancerId, { fill: string; stroke: string; label: string }> = {
  up_lark_0:    { fill: '#4a90d9', stroke: '#6ab0ff', label: 'UL' },
  up_robin_0:   { fill: '#d94a4a', stroke: '#ff6a6a', label: 'UR' },
  down_lark_0:  { fill: '#2a60a9', stroke: '#4a80c9', label: 'DL' },
  down_robin_0: { fill: '#a92a2a', stroke: '#c94a4a', label: 'DR' },
};

const MARGIN = 40;
const PX_PER_METER = 103; // fixed scale: (700 - 80) / 6 ≈ 103

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private usableW: number;
  private usableH: number;
  private xRange: number;
  private yRange: number;
  private cameraY = 0;
  private trails: Partial<Record<ProtoDancerId, { x: number; y: number }[]>> = {};
  private trailLength = 20;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.usableW = width - 2 * MARGIN;
    this.usableH = height - 2 * MARGIN;
    this.yRange = this.usableH / PX_PER_METER;
    this.xRange = this.usableW / PX_PER_METER;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.usableW = width - 2 * MARGIN;
    this.usableH = height - 2 * MARGIN;
    this.yRange = this.usableH / PX_PER_METER;
    this.xRange = this.usableW / PX_PER_METER;
  }

  clearTrails() {
    this.trails = {};
  }

  private worldToCanvas(wx: number, wy: number): [number, number] {
    const cx = MARGIN + (wx + this.xRange / 2) / this.xRange * this.usableW;
    const cy = MARGIN + ((this.cameraY + this.yRange / 2) - wy) / this.yRange * this.usableH;
    return [cx, cy];
  }

  drawFrame(frame: Keyframe, progressionRate: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.cameraY = progressionRate * frame.beat;

    const viewYMin = this.cameraY - this.yRange / 2;
    const viewYMax = this.cameraY + this.yRange / 2;

    // Grid lines (set boundaries at x = ±0.5)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (const x of [-0.5, 0.5]) {
      const [cx1, cy1] = this.worldToCanvas(x, viewYMax + 1);
      const [cx2, cy2] = this.worldToCanvas(x, viewYMin - 1);
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    }

    // Horizontal dividers between hands-fours (every 2m)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#222';
    const firstDivider = Math.floor((viewYMin - 1) / 2) * 2;
    for (let y = firstDivider; y <= viewYMax + 1; y += 2) {
      const [cx1, cy1] = this.worldToCanvas(-this.xRange / 2, y);
      const [cx2, cy2] = this.worldToCanvas(this.xRange / 2, y);
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // "up" arrow label
    ctx.fillStyle = '#444';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const [arx, ary] = this.worldToCanvas(-this.xRange / 2 + 0.15, viewYMax - 0.3);
    ctx.fillText('\u2191 up', arx, ary);

    // Hand connections
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    for (const h of frame.hands) {
      const da = dancerPosition(h.a, frame.dancers);
      const db = dancerPosition(h.b, frame.dancers);
      this.drawHandsForAllCopies(da, h.ha, db, h.hb);
    }

    // Dancers tiled every 2m to fill viewport
    const firstCopy = Math.floor((viewYMin - 1) / 2) * 2;
    const lastCopy = Math.ceil((viewYMax + 1) / 2) * 2;
    for (let offset = firstCopy; offset <= lastCopy; offset += 2) {
      for (const id of ProtoDancerIdSchema.options) {
        const d = frame.dancers[id];
        this.drawDancer(id, d.pos.x, d.pos.y + offset, d.facing, offset === 0 ? 1.0 : 0.35);
      }
    }

    // Update and draw trails
    for (const id of ProtoDancerIdSchema.options) {
      const d = frame.dancers[id];
      if (!this.trails[id]) this.trails[id] = [];
      this.trails[id]!.push({ x: d.pos.x, y: d.pos.y });
      if (this.trails[id]!.length > this.trailLength) this.trails[id]!.shift();
    }

    for (const id of ProtoDancerIdSchema.options) {
      const trail = this.trails[id];
      if (!trail) continue;
      const color = COLORS[id];
      ctx.strokeStyle = color.fill;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const [tcx, tcy] = this.worldToCanvas(trail[i].x, trail[i].y);
        if (i === 0) ctx.moveTo(tcx, tcy);
        else ctx.lineTo(tcx, tcy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }

  private handAnchorOffset(facing: number, hand: 'left' | 'right', r: number): [number, number] {
    const sign = hand === 'right' ? 1 : -1;
    return [Math.cos(facing) * sign * r, Math.sin(facing) * sign * r];
  }

  private drawHandsForAllCopies(da: DancerState, handA: 'left' | 'right', db: DancerState, handB: 'left' | 'right') {
    const ctx = this.ctx;
    const viewYMin = this.cameraY - this.yRange / 2;
    const viewYMax = this.cameraY + this.yRange / 2;
    const firstCopy = Math.floor((viewYMin - 1) / 2) * 2;
    const lastCopy = Math.ceil((viewYMax + 1) / 2) * 2;
    const r = 14;
    const [dxA, dyA] = this.handAnchorOffset(da.facing, handA, r);
    const [dxB, dyB] = this.handAnchorOffset(db.facing, handB, r);
    for (let offset = firstCopy; offset <= lastCopy; offset += 2) {
      ctx.globalAlpha = offset === 0 ? 1.0 : 0.35;
      const [ax, ay] = this.worldToCanvas(da.pos.x, da.pos.y + offset);
      const [bx, by] = this.worldToCanvas(db.pos.x, db.pos.y + offset);
      ctx.beginPath();
      ctx.moveTo(ax + dxA, ay + dyA);
      ctx.lineTo(bx + dxB, by + dyB);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  /** Draw ghostly preview keyframes: path lines connecting adjacent positions. */
  drawPreviewKeyframes(keyframes: Keyframe[]) {
    if (keyframes.length === 0) return;
    const ctx = this.ctx;

    // Draw path lines for each dancer
    for (const id of ProtoDancerIdSchema.options) {
      const color = COLORS[id];
      ctx.strokeStyle = color.fill;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < keyframes.length; i++) {
        const d = keyframes[i].dancers[id];
        const [cx, cy] = this.worldToCanvas(d.pos.x, d.pos.y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Always show the final keyframe ghost
    const last = keyframes[keyframes.length - 1];
    for (const id of ProtoDancerIdSchema.options) {
      const d = last.dancers[id];
      this.drawGhostDancer(id, d.pos.x, d.pos.y, d.facing);
    }

    ctx.globalAlpha = 1.0;
  }

  private drawGhostDancer(id: ProtoDancerId, x: number, y: number, facing: number) {
    const color = COLORS[id];
    if (!color) return;
    const ctx = this.ctx;
    const [cx, cy] = this.worldToCanvas(x, y);
    const r = 10; // smaller than normal dancers (14)

    ctx.globalAlpha = 0.18;

    // Circle body
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Facing arrow (shorter)
    const ax = cx + Math.sin(facing) * (r + 4);
    const ay = cy - Math.cos(facing) * (r + 4);
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    ctx.globalAlpha = 1.0;
  }

  private drawDancer(id: ProtoDancerId, x: number, y: number, facing: number, alpha: number) {
    const color = COLORS[id];
    if (!color) return;
    const ctx = this.ctx;
    const [cx, cy] = this.worldToCanvas(x, y);
    const r = 14;

    ctx.globalAlpha = alpha;

    // Circle body
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Facing arrow
    const ax = cx + Math.sin(facing) * (r + 6);
    const ay = cy - Math.cos(facing) * (r + 6);
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    // Arrowhead
    const headLen = 6;
    const headAngle = 0.4;
    const angle = Math.atan2(ay - cy, ax - cx);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - headLen * Math.cos(angle - headAngle), ay - headLen * Math.sin(angle - headAngle));
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - headLen * Math.cos(angle + headAngle), ay - headLen * Math.sin(angle + headAngle));
    ctx.stroke();

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(color.label, cx, cy);

    ctx.globalAlpha = 1.0;
  }
}

// --- Keyframe interpolation ---

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % FULL_CW) - Math.PI;
  if (diff < -Math.PI) diff += FULL_CW;
  return (a + diff * t + FULL_CW) % FULL_CW;
}

/** Unwrap an angle relative to a reference so the difference is in (-π, π]. */
function unwrapAngle(angle: number, ref: number): number {
  let diff = ((angle - ref + Math.PI) % FULL_CW) - Math.PI;
  if (diff < -Math.PI) diff += FULL_CW;
  return ref + diff;
}

/** Linear interpolation between keyframes (no smoothing). */
function rawFrameAtBeat(keyframes: Keyframe[], beat: number, danceLength: number = 64, progression: number = 0, wrap: boolean = true): Keyframe | null {
  if (keyframes.length === 0) return null;

  let cycle = 0;
  if (wrap) {
    // Compute cycle count before wrapping (negative beats go the other way)
    cycle = Math.floor(beat / danceLength);
    beat = ((beat % danceLength) + danceLength) % danceLength;

    if (beat <= keyframes[0].beat) return applyProgression(keyframes[0], cycle, progression);
    if (beat >= keyframes[keyframes.length - 1].beat) return applyProgression(keyframes[keyframes.length - 1], cycle, progression);
  } else {
    // No wrapping: clamp to keyframe range, no cycle progression
    if (beat <= keyframes[0].beat) return keyframes[0];
    if (beat >= keyframes[keyframes.length - 1].beat) return keyframes[keyframes.length - 1];
  }

  // Binary search for surrounding frames
  let lo = 0, hi = keyframes.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid].beat <= beat) lo = mid;
    else hi = mid;
  }

  const f0 = keyframes[lo];
  const f1 = keyframes[hi];
  const t = (beat - f0.beat) / (f1.beat - f0.beat);

  const dancers = buildDancerRecord(id => {
    const d0 = f0.dancers[id];
    const d1 = f1.dancers[id];
    return {
      pos: d0.pos.add(d1.pos.subtract(d0.pos).multiply(t)),
      facing: lerpAngle(d0.facing, d1.facing, t),
    };
  });

  return applyProgression({
    beat,
    dancers,
    hands: f1.hands,
    annotation: f0.annotation || f1.annotation || '',
  }, cycle, progression);
}

function applyProgression(frame: Keyframe, cycle: number, progression: number): Keyframe {
  if (cycle === 0 || progression === 0) return frame;
  const dy = cycle * progression;
  const dancers = buildDancerRecord(id => {
    const d = frame.dancers[id];
    const sign = id.startsWith('up_') ? 1 : -1;
    return { pos: new Vector(d.pos.x, d.pos.y + sign * dy), facing: d.facing };
  });
  return { ...frame, dancers };
}

const SMOOTH_SAMPLES = 10;

/**
 * Get an interpolated frame at `beat`.
 * `smoothness` is the width of a moving-average window in beats (0 = raw linear).
 */
export function getFrameAtBeat(keyframes: Keyframe[], beat: number, smoothness: number = 0, danceLength: number = 64, progression: number = 0, wrap: boolean = true): Keyframe | null {
  if (keyframes.length === 0) return null;

  if (smoothness === 0) {
    return rawFrameAtBeat(keyframes, beat, danceLength, progression, wrap);
  }

  // Sample raw interpolation at evenly spaced points across the window
  const halfWindow = smoothness / 2;
  const start = beat - halfWindow;
  const step = smoothness / (SMOOTH_SAMPLES - 1);

  // Collect all samples
  const samples: Keyframe[] = [];
  for (let i = 0; i < SMOOTH_SAMPLES; i++) {
    const s = rawFrameAtBeat(keyframes, start + i * step, danceLength, progression, wrap);
    if (!s) return null;
    samples.push(s);
  }

  // Average pos per dancer; angle-aware average for facing
  const dancers = buildDancerRecord(id => {
    let sumX = 0, sumY = 0;
    // Unwrap facing angles via chaining: each sample unwraps relative to the
    // previous one, so even fast rotations (>180° across the full window) work.
    let prevFacing = samples[0].dancers[id].facing;
    let sumFacing = 0;

    for (const s of samples) {
      const d = s.dancers[id];
      sumX += d.pos.x;
      sumY += d.pos.y;
      prevFacing = unwrapAngle(d.facing, prevFacing);
      sumFacing += prevFacing;
    }

    const n = SMOOTH_SAMPLES;
    return {
      pos: new Vector(sumX / n, sumY / n),
      facing: ((sumFacing / n % FULL_CW) + FULL_CW) % FULL_CW,
    };
  });

  // Use the center sample for hands/annotation
  const center = samples[Math.floor(SMOOTH_SAMPLES / 2)];
  return {
    beat,
    dancers,
    hands: center.hands,
    annotation: center.annotation || '',
  };
}
