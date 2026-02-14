import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Renderer, getFrameAtBeat } from "./renderer";
import { generateAllKeyframes } from "./generate";
import {
  validateHandDistances,
  collectKeyframeWarnings,
} from "./validate";
import { instructionDuration } from "./instruction-tree";
import CommandPane from "./CommandPane";
import type { Instruction, InstructionId } from "./types";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 700;
const PROGRESSION_RATE = -1 / 64;

function activeInstructionId(
  instructions: Instruction[],
  beat: number,
): InstructionId | null {
  let currentBeat = 0;
  let activeId: InstructionId | null = null;
  for (const instr of instructions) {
    if (currentBeat > beat + 1e-9) break;
    activeId = instr.id;
    if (instr.type === "group") {
      // Recurse into group children to find the active leaf
      const childId = activeInstructionId(
        instr.instructions,
        beat - currentBeat,
      );
      if (childId !== null) activeId = childId;
    }
    currentBeat += instructionDuration(instr);
  }
  return activeId;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const beatRef = useRef(0);
  const playingRef = useRef(false);
  const lastTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [beat, setBeat] = useState(0);
  const [annotation, setAnnotation] = useState("");
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [smoothness, setSmoothness] = useState(100);

  const bpmRef = useRef(120);
  const smoothnessRef = useRef(1);

  const { keyframes, errors: generationErrors } = useMemo(
    () => generateAllKeyframes(instructions),
    [instructions],
  );
  const warnings = useMemo(() => {
    const handWarnings = validateHandDistances(instructions, keyframes);
    const kfWarnings = collectKeyframeWarnings(instructions, keyframes);
    const merged = new Map(handWarnings);
    for (const [id, w] of kfWarnings) {
      const existing = merged.get(id);
      merged.set(id, existing ? `${existing}; ${w}` : w);
    }
    for (const [id, w] of generationErrors) {
      const existing = merged.get(id);
      merged.set(id, existing ? `${existing}; ${w}` : w);
    }
    return merged;
  }, [instructions, keyframes, generationErrors]);

  const minBeat = keyframes.length > 0 ? keyframes[0].beat : 0;
  const maxBeat =
    keyframes.length > 0 ? keyframes[keyframes.length - 1].beat : 0;

  // Keep a ref to keyframes for the animation loop
  const keyframesRef = useRef(keyframes);
  keyframesRef.current = keyframes;
  const minBeatRef = useRef(minBeat);
  minBeatRef.current = minBeat;
  const maxBeatRef = useRef(maxBeat);
  maxBeatRef.current = maxBeat;

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const frame = getFrameAtBeat(
      keyframesRef.current,
      beatRef.current,
      smoothnessRef.current,
    );
    if (frame) {
      renderer.drawFrame(frame, PROGRESSION_RATE);
      setAnnotation(frame.annotation || "");
    }
    setBeat(beatRef.current);
  }, []);

  // Redraw when keyframes change
  useEffect(() => {
    // Clamp beat to new range
    if (beatRef.current > maxBeat) {
      beatRef.current = maxBeat;
    }
    draw();
  }, [keyframes, maxBeat, draw]);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    rendererRef.current = new Renderer(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
    draw();
  }, [draw]);

  // Animation loop
  const animate = useCallback(
    (timestamp: number) => {
      if (!playingRef.current) return;
      if (lastTimestampRef.current === null)
        lastTimestampRef.current = timestamp;

      const dt = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      beatRef.current += dt * (bpmRef.current / 60);
      if (beatRef.current > maxBeatRef.current) {
        beatRef.current = minBeatRef.current;
        rendererRef.current?.clearTrails();
      }

      draw();
      rafRef.current = requestAnimationFrame(animate);
    },
    [draw],
  );

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

  const stepFwd = useCallback(() => {
    beatRef.current = Math.min(beatRef.current + 0.25, maxBeatRef.current);
    draw();
  }, [draw]);

  const stepBack = useCallback(() => {
    beatRef.current = Math.max(beatRef.current - 0.25, minBeatRef.current);
    draw();
  }, [draw]);

  const scrub = useCallback(
    (val: number) => {
      const range = maxBeatRef.current - minBeatRef.current;
      if (range <= 0) {
        beatRef.current = minBeatRef.current;
      } else {
        const pct = val / 1000;
        beatRef.current = minBeatRef.current + pct * range;
      }
      rendererRef.current?.clearTrails();
      draw();
    },
    [draw],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        stepFwd();
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        stepBack();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [togglePlay, stepFwd, stepBack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const scrubberValue =
    maxBeat > minBeat
      ? Math.round(((beat - minBeat) / (maxBeat - minBeat)) * 1000)
      : 0;

  return (
    <div className="app-layout">
      <div className="canvas-column">
        <h1>Contra Dance Visualizer</h1>
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        <div className="controls">
          <button onClick={togglePlay}>
            {playing ? "\u23F8 Pause" : "\u25B6 Play"}
          </button>
          <button onClick={stepBack}>{"\u25C0 Step"}</button>
          <button onClick={stepFwd}>{"Step \u25B6"}</button>
          <input
            type="range"
            min={0}
            max={1000}
            value={scrubberValue}
            onChange={(e) => scrub(Number(e.target.value))}
          />
          <div className="beat-display">Beat {Math.floor(beat)}</div>
        </div>
        <div className="controls">
          <span className="speed-display">{bpm} BPM</span>
          <input
            type="range"
            min={60}
            max={120}
            value={bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              bpmRef.current = v;
              setBpm(v);
            }}
          />
        </div>
        <div className="controls">
          <span className="speed-display">
            Smooth {(smoothness / 100).toFixed(1)} beats
          </span>
          <input
            type="range"
            min={0}
            max={200}
            value={smoothness}
            onChange={(e) => {
              const v = Number(e.target.value);
              smoothnessRef.current = v / 100;
              setSmoothness(v);
            }}
          />
        </div>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#4a90d9" }} />{" "}
            Lark
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "#d94a4a" }} />{" "}
            Robin
          </div>
          <div className="legend-item">
            <span style={{ color: "#7a7" }}>{"\u25B2"}</span> Up (progressing
            north)
          </div>
          <div className="legend-item">
            <span style={{ color: "#a77" }}>{"\u25BC"}</span> Down (progressing
            south)
          </div>
        </div>
        {annotation && <div className="annotation">{annotation}</div>}
      </div>
      <CommandPane
        instructions={instructions}
        setInstructions={setInstructions}
        activeId={activeInstructionId(instructions, beat)}
        warnings={warnings}
      />
    </div>
  );
}
