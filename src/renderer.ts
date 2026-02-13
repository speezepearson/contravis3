import type { DancerState, Keyframe, ProtoDancerId } from './types';
import { dancerPosition, makeDancerId, parseDancerId } from './types';

const COLORS: Record<ProtoDancerId, { fill: string; stroke: string; label: string }> = {
  up_lark:    { fill: '#4a90d9', stroke: '#6ab0ff', label: 'UL' },
  up_robin:   { fill: '#d94a4a', stroke: '#ff6a6a', label: 'UR' },
  down_lark:  { fill: '#2a60a9', stroke: '#4a80c9', label: 'DL' },
  down_robin: { fill: '#a92a2a', stroke: '#c94a4a', label: 'DR' },
};

const MARGIN = 40;
const Y_RANGE = 6; // meters shown vertically

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private usableW: number;
  private usableH: number;
  private xRange: number;
  private cameraY = 0;
  private trails: Partial<Record<ProtoDancerId, { x: number; y: number }[]>> = {};
  private trailLength = 20;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.usableW = width - 2 * MARGIN;
    this.usableH = height - 2 * MARGIN;
    const pxPerMeter = this.usableH / Y_RANGE;
    this.xRange = this.usableW / pxPerMeter;
  }

  clearTrails() {
    this.trails = {};
  }

  private worldToCanvas(wx: number, wy: number): [number, number] {
    const cx = MARGIN + (wx + this.xRange / 2) / this.xRange * this.usableW;
    const cy = MARGIN + ((this.cameraY + Y_RANGE / 2) - wy) / Y_RANGE * this.usableH;
    return [cx, cy];
  }

  drawFrame(frame: Keyframe, progressionRate: number) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.cameraY = progressionRate * frame.beat;

    const viewYMin = this.cameraY - Y_RANGE / 2;
    const viewYMax = this.cameraY + Y_RANGE / 2;

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

    // Hand connections (deduplicate: only draw when proto < targetProto, or same proto with offset > 0)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    const PROTO_IDS: ProtoDancerId[] = ['up_lark', 'up_robin', 'down_lark', 'down_robin'];
    for (const proto of PROTO_IDS) {
      const dh = frame.hands[proto];
      for (const hand of ['left', 'right'] as const) {
        const held = dh[hand];
        if (!held) continue;
        const [targetId, targetHand] = held;
        const { proto: targetProto, offset } = parseDancerId(targetId);
        // Deduplicate: only draw one direction
        if (proto < targetProto || (proto === targetProto && offset > 0)) {
          const da = dancerPosition(makeDancerId(proto, 0), frame.dancers);
          const db = dancerPosition(targetId, frame.dancers);
          this.drawHandsForAllCopies(da, hand, db, targetHand);
        }
      }
    }

    // Dancers tiled every 2m to fill viewport
    const firstCopy = Math.floor((viewYMin - 1) / 2) * 2;
    const lastCopy = Math.ceil((viewYMax + 1) / 2) * 2;
    for (let offset = firstCopy; offset <= lastCopy; offset += 2) {
      for (const [id, d] of Object.entries(frame.dancers) as [ProtoDancerId, DancerState][]) {
        this.drawDancer(id, d.x, d.y + offset, d.facing, offset === 0 ? 1.0 : 0.35);
      }
    }

    // Update and draw trails
    for (const [id, d] of Object.entries(frame.dancers) as [ProtoDancerId, DancerState][]) {
      if (!this.trails[id]) this.trails[id] = [];
      this.trails[id]!.push({ x: d.x, y: d.y });
      if (this.trails[id]!.length > this.trailLength) this.trails[id]!.shift();
    }

    for (const [id, trail] of Object.entries(this.trails) as [ProtoDancerId, { x: number; y: number }[]][]) {
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
    const fRad = facing * Math.PI / 180;
    const sign = hand === 'right' ? 1 : -1;
    return [Math.cos(fRad) * sign * r, Math.sin(fRad) * sign * r];
  }

  private drawHandsForAllCopies(da: DancerState, handA: 'left' | 'right', db: DancerState, handB: 'left' | 'right') {
    const ctx = this.ctx;
    const viewYMin = this.cameraY - Y_RANGE / 2;
    const viewYMax = this.cameraY + Y_RANGE / 2;
    const firstCopy = Math.floor((viewYMin - 1) / 2) * 2;
    const lastCopy = Math.ceil((viewYMax + 1) / 2) * 2;
    const r = 14;
    const [dxA, dyA] = this.handAnchorOffset(da.facing, handA, r);
    const [dxB, dyB] = this.handAnchorOffset(db.facing, handB, r);
    for (let offset = firstCopy; offset <= lastCopy; offset += 2) {
      ctx.globalAlpha = offset === 0 ? 1.0 : 0.35;
      const [ax, ay] = this.worldToCanvas(da.x, da.y + offset);
      const [bx, by] = this.worldToCanvas(db.x, db.y + offset);
      ctx.beginPath();
      ctx.moveTo(ax + dxA, ay + dyA);
      ctx.lineTo(bx + dxB, by + dyB);
      ctx.stroke();
    }
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
    const ax = cx + Math.sin(facing * Math.PI / 180) * (r + 6);
    const ay = cy - Math.cos(facing * Math.PI / 180) * (r + 6);
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
  let diff = ((b - a + 180) % 360) - 180;
  if (diff < -180) diff += 360;
  return (a + diff * t + 360) % 360;
}

/** Unwrap an angle relative to a reference so the difference is in (-180, 180]. */
function unwrapAngle(angle: number, ref: number): number {
  let diff = ((angle - ref + 180) % 360) - 180;
  if (diff < -180) diff += 360;
  return ref + diff;
}

/** Linear interpolation between keyframes (no smoothing). */
function rawFrameAtBeat(keyframes: Keyframe[], beat: number): Keyframe | null {
  if (keyframes.length === 0) return null;
  if (beat <= keyframes[0].beat) return keyframes[0];
  if (beat >= keyframes[keyframes.length - 1].beat) return keyframes[keyframes.length - 1];

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

  const dancers = {} as Record<ProtoDancerId, DancerState>;
  for (const id of Object.keys(f0.dancers) as ProtoDancerId[]) {
    const d0 = f0.dancers[id];
    const d1 = f1.dancers[id];
    dancers[id] = {
      x: d0.x + (d1.x - d0.x) * t,
      y: d0.y + (d1.y - d0.y) * t,
      facing: lerpAngle(d0.facing, d1.facing, t),
    };
  }

  return {
    beat,
    dancers,
    hands: f1.hands,
    annotation: f0.annotation || f1.annotation || '',
  };
}

const SMOOTH_SAMPLES = 10;

/**
 * Get an interpolated frame at `beat`.
 * `smoothness` is the width of a moving-average window in beats (0 = raw linear).
 */
export function getFrameAtBeat(keyframes: Keyframe[], beat: number, smoothness: number = 0): Keyframe | null {
  if (keyframes.length === 0) return null;

  if (smoothness === 0) {
    return rawFrameAtBeat(keyframes, beat);
  }

  // Sample raw interpolation at evenly spaced points across the window
  const halfWindow = smoothness / 2;
  const start = beat - halfWindow;
  const step = smoothness / (SMOOTH_SAMPLES - 1);

  // Collect all samples
  const samples: Keyframe[] = [];
  for (let i = 0; i < SMOOTH_SAMPLES; i++) {
    const s = rawFrameAtBeat(keyframes, start + i * step);
    if (!s) return null;
    samples.push(s);
  }

  // Average x, y per dancer; angle-aware average for facing
  const ids = Object.keys(samples[0].dancers) as ProtoDancerId[];
  const dancers = {} as Record<ProtoDancerId, DancerState>;

  for (const id of ids) {
    let sumX = 0, sumY = 0;
    // Unwrap all facing angles relative to the first sample to avoid 0/360 jumps
    const refFacing = samples[0].dancers[id].facing;
    let sumFacing = 0;

    for (const s of samples) {
      const d = s.dancers[id];
      sumX += d.x;
      sumY += d.y;
      sumFacing += unwrapAngle(d.facing, refFacing);
    }

    const n = SMOOTH_SAMPLES;
    dancers[id] = {
      x: sumX / n,
      y: sumY / n,
      facing: ((sumFacing / n % 360) + 360) % 360,
    };
  }

  // Use the center sample for hands/annotation
  const center = samples[Math.floor(SMOOTH_SAMPLES / 2)];
  return {
    beat,
    dancers,
    hands: center.hands,
    annotation: center.annotation || '',
  };
}
