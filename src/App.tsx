import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Renderer, getFrameAtBeat } from './renderer';
import { generateAllKeyframes, validateHandDistances, validateProgression, generateInstructionPreview, findInstructionStartBeat, findInstructionScope } from './generate';
import { exportGif } from './exportGif';
import CommandPane from './CommandPane';
import type { Instruction, InitFormation, InstructionId, Keyframe, Dance } from './types';
import { splitLists, instructionDuration, InstructionSchema, DanceSchema, formatDanceParseError } from './types';

const DANCE_LENGTH = 64;
const LOCALSTORAGE_KEY = 'contravis3-dance';

function loadDanceFromLocalStorage(): { dance: Dance } | { error: string } | null {
  let raw: string | null;
  try { raw = localStorage.getItem(LOCALSTORAGE_KEY); } catch { return null; }
  if (raw === null) return null;

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch (e) {
    return { error: `Saved dance JSON is malformed: ${e instanceof SyntaxError ? e.message : String(e)}` };
  }

  const result = DanceSchema.safeParse(parsed);
  if (!result.success) {
    return { error: formatDanceParseError(result.error, parsed) };
  }
  return { dance: result.data };
}

function findInstructionById(instrs: Instruction[], id: InstructionId): Instruction | null {
  for (const i of instrs) {
    if (i.id === id) return i;
    if (i.type === 'group') {
      const found = findInstructionById(i.instructions, id);
      if (found) return found;
    }
    if (i.type === 'split') {
      const [listA, listB] = splitLists(i);
      for (const s of [...listA, ...listB]) {
        if (s.id === id) return InstructionSchema.parse(s);
      }
    }
  }
  return null;
}

function activeInstructionId(instructions: Instruction[], beat: number): InstructionId | null {
  let currentBeat = 0;
  let activeId: InstructionId | null = null;
  for (const instr of instructions) {
    if (currentBeat > beat + 1e-9) break;
    if (instr.type === 'group') {
      const childId = activeInstructionId(instr.instructions, beat - currentBeat);
      if (childId !== null) activeId = childId;
    } else if (instr.type === 'split') {
      const rel = beat - currentBeat;
      const [listA, listB] = splitLists(instr);
      let b = 0;
      for (const sub of listA) {
        if (b > rel + 1e-9) break;
        activeId = sub.id;
        b += sub.beats;
      }
      b = 0;
      for (const sub of listB) {
        if (b > rel + 1e-9) break;
        activeId = sub.id;
        b += sub.beats;
      }
    } else {
      activeId = instr.id;
    }
    currentBeat += instructionDuration(instr);
  }
  return activeId;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const beatRef = useRef(0);
  const playingRef = useRef(false);
  const lastTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const [initialLoadResult] = useState(() => loadDanceFromLocalStorage());
  const [localStorageError, setLocalStorageError] = useState<string | null>(
    () => initialLoadResult && 'error' in initialLoadResult ? initialLoadResult.error : null,
  );

  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [beat, setBeat] = useState(0);
  const [annotation, setAnnotation] = useState('');
  const [instructions, setInstructions] = useState<Instruction[]>(
    () => initialLoadResult && 'dance' in initialLoadResult ? initialLoadResult.dance.instructions : [],
  );
  const [initFormation, setInitFormation] = useState<InitFormation>(
    () => initialLoadResult && 'dance' in initialLoadResult ? initialLoadResult.dance.initFormation : 'improper',
  );
  const [progression, setProgression] = useState(
    () => initialLoadResult && 'dance' in initialLoadResult ? initialLoadResult.dance.progression : 1,
  );
  const [smoothness, setSmoothness] = useState(100);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Persist dance to localStorage whenever it changes
  useEffect(() => {
    try {
      const dance = { initFormation, progression, instructions };
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(dance));
    } catch { /* quota exceeded or private browsing – silently ignore */ }
  }, [instructions, initFormation, progression]);

  const [hoveredInstructionId, setHoveredInstructionId] = useState<InstructionId | null>(null);

  const bpmRef = useRef(90);
  const smoothnessRef = useRef(1);
  const progressionRef = useRef(1);
  const wrapRef = useRef(true);

  const { keyframes, error: generateError } = useMemo(() => generateAllKeyframes(instructions, initFormation), [instructions, initFormation]);
  const warnings = useMemo(() => validateHandDistances(instructions, keyframes), [instructions, keyframes]);
  const progressionWarning = useMemo(() => validateProgression(keyframes, initFormation, progression), [keyframes, initFormation, progression]);
  useEffect(() => { wrapRef.current = !progressionWarning; }, [progressionWarning]);

  const minBeat = 0;
  const maxBeat = DANCE_LENGTH;

  // Compute preview keyframes when hovering over an instruction
  const previewKeyframes = useMemo(() => {
    if (!hoveredInstructionId) return [];
    const instr = findInstructionById(instructions, hoveredInstructionId);
    if (!instr) return [];
    const startBeat = findInstructionStartBeat(instructions, hoveredInstructionId) ?? 0;
    const scope = findInstructionScope(instructions, hoveredInstructionId);

    // Find the keyframe at or before the start beat
    let prevKeyframe: Keyframe | null = null;
    for (const kf of keyframes) {
      if (kf.beat <= startBeat + 1e-6) prevKeyframe = kf;
      else break;
    }
    if (!prevKeyframe) return [];
    return generateInstructionPreview(instr, prevKeyframe, scope) ?? [];
  }, [hoveredInstructionId, instructions, keyframes]);

  // Keep a ref to keyframes for the animation loop
  const keyframesRef = useRef(keyframes);
  const minBeatRef = useRef(minBeat);
  const maxBeatRef = useRef(maxBeat);
  const previewKeyframesRef = useRef<Keyframe[]>([]);
  useEffect(() => {
    keyframesRef.current = keyframes;
    minBeatRef.current = minBeat;
    maxBeatRef.current = maxBeat;
  }, [keyframes, minBeat, maxBeat]);
  useEffect(() => {
    previewKeyframesRef.current = previewKeyframes;
  }, [previewKeyframes]);

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const frame = getFrameAtBeat(keyframesRef.current, beatRef.current, smoothnessRef.current, DANCE_LENGTH, progressionRef.current, wrapRef.current);
    if (frame) {
      renderer.drawFrame(frame, -progressionRef.current / DANCE_LENGTH);
      setAnnotation(frame.annotation || '');
    }
    // Draw preview keyframes overlay
    if (previewKeyframesRef.current.length > 0) {
      renderer.drawPreviewKeyframes(previewKeyframesRef.current);
    }
    setBeat(beatRef.current);
  }, []);

  // Redraw when keyframes or preview change (deferred to avoid synchronous setState in effect)
  useEffect(() => {
    const id = requestAnimationFrame(() => draw());
    return () => cancelAnimationFrame(id);
  }, [keyframes, previewKeyframes, draw]);

  // Initialize renderer + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const applySize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = w;
      canvas.height = h;
      if (!rendererRef.current) {
        rendererRef.current = new Renderer(ctx, w, h);
      } else {
        rendererRef.current.resize(w, h);
      }
      draw();
    };

    applySize();

    let resizeRaf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(applySize);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeRaf);
    };
  }, [draw]);

  // Animation loop – stored in a ref so the rAF callback can self-schedule
  // without referencing a variable before its declaration completes.
  const animateRef = useRef<(timestamp: number) => void>(undefined);
  useEffect(() => {
    animateRef.current = (timestamp: number) => {
      if (!playingRef.current) return;
      if (lastTimestampRef.current === null) lastTimestampRef.current = timestamp;

      const dt = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      beatRef.current += dt * (bpmRef.current / 60);
      if (beatRef.current > maxBeatRef.current) {
        beatRef.current = minBeatRef.current;
        rendererRef.current?.clearTrails();
      }

      draw();
      rafRef.current = requestAnimationFrame((ts) => animateRef.current!(ts));
    };
  }, [draw]);

  const togglePlay = useCallback(() => {
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    if (next) {
      lastTimestampRef.current = null;
      rafRef.current = requestAnimationFrame((ts) => animateRef.current!(ts));
    } else {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  const stepFwd = useCallback(() => {
    beatRef.current = Math.min(beatRef.current + 0.25, maxBeatRef.current);
    draw();
  }, [draw]);

  const stepBack = useCallback(() => {
    beatRef.current = Math.max(beatRef.current - 0.25, minBeatRef.current);
    draw();
  }, [draw]);

  const scrub = useCallback((val: number) => {
    const range = maxBeatRef.current - minBeatRef.current;
    if (range <= 0) {
      beatRef.current = minBeatRef.current;
    } else {
      const pct = val / 1000;
      beatRef.current = minBeatRef.current + pct * range;
    }
    rendererRef.current?.clearTrails();
    draw();
  }, [draw]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      const tag = e.target instanceof HTMLElement ? e.target.tagName : undefined;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
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

  const handleHoverInstruction = useCallback((id: InstructionId | null) => {
    setHoveredInstructionId(id);
  }, []);

  const downloadGif = useCallback(() => {
    if (keyframes.length === 0) return;
    setExporting(true);
    // Yield to let the UI show the "Exporting..." state before blocking
    setTimeout(() => {
      const w = 400;
      const h = 600;
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const offCtx = offscreen.getContext('2d')!;
      const gifBytes = exportGif(keyframes, offCtx, {
        width: w,
        height: h,
        bpm,
        smoothness: smoothnessRef.current,
        progressionRate: -progressionRef.current / DANCE_LENGTH,
        progression: progressionRef.current,
        wrap: wrapRef.current,
      });
      const blob = new Blob([gifBytes.buffer as ArrayBuffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dance.gif';
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 50);
  }, [keyframes, bpm]);

  const scrubberValue = maxBeat > minBeat
    ? Math.round((beat - minBeat) / (maxBeat - minBeat) * 1000)
    : 0;

  const controlsBlock = (
    <>
      <div className="controls">
        <button onClick={togglePlay}>
          {playing ? '\u23F8 Pause' : '\u25B6 Play'}
        </button>
        <button onClick={stepBack}>{'\u25C0 Step'}</button>
        <button onClick={stepFwd}>{'Step \u25B6'}</button>
        <button onClick={downloadGif} disabled={exporting || keyframes.length === 0} className="gif-btn">
          {exporting ? 'Exporting\u2026' : 'Download GIF'}
        </button>
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
        <span className="speed-display">{bpm} BPM</span>
        <input
          type="range"
          min={60}
          max={120}
          value={bpm}
          onChange={e => { const v = Number(e.target.value); bpmRef.current = v; setBpm(v); }}
        />
      </div>
      <div className="controls">
        <span className="speed-display">Smooth {(smoothness / 100).toFixed(1)} beats</span>
        <input
          type="range"
          min={0}
          max={200}
          value={smoothness}
          onChange={e => { const v = Number(e.target.value); smoothnessRef.current = v / 100; setSmoothness(v); }}
        />
      </div>
      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#4a90d9' }} /> Lark
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#d94a4a' }} /> Robin
        </div>
        <div className="legend-item">
          <span style={{ color: '#7a7' }}>{'\u25B2'}</span> Up
        </div>
        <div className="legend-item">
          <span style={{ color: '#a77' }}>{'\u25BC'}</span> Down
        </div>
      </div>
      {annotation && <div className="annotation">{annotation}</div>}
    </>
  );

  return (
    <div className="app-layout">
      {localStorageError && (
        <div className="localstorage-error">
          <strong>Could not load saved dance from localStorage:</strong>
          <pre>{localStorageError}</pre>
          <button onClick={() => setLocalStorageError(null)}>Dismiss</button>
        </div>
      )}
      <div className="vis-column">
        <div className="canvas-container" ref={canvasContainerRef}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="sidebar-column">
        <div className="sidebar-instructions">
          <CommandPane instructions={instructions} setInstructions={setInstructions} initFormation={initFormation} setInitFormation={setInitFormation} progression={progression} setProgression={p => { progressionRef.current = p; setProgression(p); }} activeId={activeInstructionId(instructions, beat)} warnings={warnings} generateError={generateError} progressionWarning={progressionWarning} onHoverInstruction={handleHoverInstruction} />
        </div>
        <div className="sidebar-controls">
          {controlsBlock}
        </div>
      </div>

      {/* Mobile controls overlay */}
      <div className="mobile-controls">
        {controlsBlock}
        <button className="drawer-toggle" onClick={() => setDrawerOpen(!drawerOpen)}>
          {drawerOpen ? '\u25BC Hide Instructions' : '\u25B2 Show Instructions'}
        </button>
      </div>

      {/* Mobile instruction drawer */}
      <div className={`instruction-drawer ${drawerOpen ? 'open' : ''}`}>
        <CommandPane instructions={instructions} setInstructions={setInstructions} initFormation={initFormation} setInitFormation={setInitFormation} progression={progression} setProgression={p => { progressionRef.current = p; setProgression(p); }} activeId={activeInstructionId(instructions, beat)} warnings={warnings} generateError={generateError} progressionWarning={progressionWarning} onHoverInstruction={handleHoverInstruction} />
      </div>
    </div>
  );
}
