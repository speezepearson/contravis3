import { useRef, useEffect, useCallback, useState } from 'react';
import { Renderer, getFrameAtBeat } from './renderer';
import { KEYFRAMES, PROGRESSION_RATE } from './data';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;

const minBeat = KEYFRAMES.length > 0 ? KEYFRAMES[0].beat : 0;
const maxBeat = KEYFRAMES.length > 0 ? KEYFRAMES[KEYFRAMES.length - 1].beat : 64;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const beatRef = useRef(minBeat);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const lastTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [beat, setBeat] = useState(minBeat);
  const [annotation, setAnnotation] = useState('');

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const frame = getFrameAtBeat(KEYFRAMES, beatRef.current);
    if (frame) {
      renderer.drawFrame(frame, PROGRESSION_RATE);
      setAnnotation(frame.annotation || '');
    }
    setBeat(beatRef.current);
  }, []);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    rendererRef.current = new Renderer(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    draw();
  }, [draw]);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!playingRef.current) return;
    if (lastTimestampRef.current === null) lastTimestampRef.current = timestamp;

    const dt = (timestamp - lastTimestampRef.current) / 1000;
    lastTimestampRef.current = timestamp;

    beatRef.current += dt * speedRef.current * 4; // 4 beats/sec at 1x
    if (beatRef.current > maxBeat) {
      beatRef.current = minBeat;
      rendererRef.current?.clearTrails();
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  const togglePlay = useCallback(() => {
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    if (next) {
      lastTimestampRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
  }, [animate]);

  const changeSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeed(s);
  }, []);

  const stepFwd = useCallback(() => {
    beatRef.current = Math.min(beatRef.current + 0.25, maxBeat);
    draw();
  }, [draw]);

  const stepBack = useCallback(() => {
    beatRef.current = Math.max(beatRef.current - 0.25, minBeat);
    draw();
  }, [draw]);

  const scrub = useCallback((val: number) => {
    const pct = val / 1000;
    beatRef.current = minBeat + pct * (maxBeat - minBeat);
    rendererRef.current?.clearTrails();
    draw();
  }, [draw]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') { e.preventDefault(); stepFwd(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); stepBack(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [togglePlay, stepFwd, stepBack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const scrubberValue = maxBeat > minBeat
    ? Math.round((beat - minBeat) / (maxBeat - minBeat) * 1000)
    : 0;

  return (
    <div className="app">
      <h1>Contra Dance Visualizer</h1>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
      <div className="controls">
        <button onClick={togglePlay}>
          {playing ? '\u23F8 Pause' : '\u25B6 Play'}
        </button>
        <button onClick={stepBack}>{'\u25C0 Step'}</button>
        <button onClick={stepFwd}>{'Step \u25B6'}</button>
        <input
          type="range"
          min={0}
          max={1000}
          value={scrubberValue}
          onChange={e => scrub(Number(e.target.value))}
        />
        <div className="beat-display">Beat {beat.toFixed(1)}</div>
      </div>
      <div className="controls">
        <span className="speed-display">Speed:</span>
        {[0.25, 0.5, 1, 2, 4].map(s => (
          <button
            key={s}
            className={speed === s ? 'active' : ''}
            onClick={() => changeSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>
      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#4a90d9' }} /> Lark
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#d94a4a' }} /> Robin
        </div>
        <div className="legend-item">
          <span style={{ color: '#7a7' }}>{'\u25B2'}</span> Up (progressing north)
        </div>
        <div className="legend-item">
          <span style={{ color: '#a77' }}>{'\u25BC'}</span> Down (progressing south)
        </div>
      </div>
      {annotation && <div className="annotation">{annotation}</div>}
    </div>
  );
}
