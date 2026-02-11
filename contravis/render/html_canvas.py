"""Self-contained HTML+JS+Canvas animation renderer."""

from __future__ import annotations

import json
from pathlib import Path

from ..types import DancerID, Keyframe


def keyframes_to_json(keyframes: list[Keyframe]) -> str:
    """Convert keyframes to JSON for embedding in HTML."""
    frames = []
    for kf in keyframes:
        dancers = {}
        for did, ds in kf.dancers.items():
            dancers[did.value] = {
                "x": round(ds.x, 4),
                "y": round(ds.y, 4),
                "facing": round(ds.facing, 2),
            }
        hands = []
        for hc in kf.hands:
            hands.append({
                "a": hc.dancer_a.value,
                "ha": hc.hand_a.value,
                "b": hc.dancer_b.value,
                "hb": hc.hand_b.value,
            })
        frames.append({
            "beat": round(kf.beat, 3),
            "dancers": dancers,
            "hands": hands,
            "annotation": kf.annotation,
        })
    return json.dumps(frames)


_HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Contra Dance Visualizer</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    padding: 20px;
}
h1 { font-size: 1.4em; margin-bottom: 10px; color: #a0c4ff; }
canvas {
    border: 1px solid #333;
    border-radius: 8px;
    background: #0f0f23;
}
.controls {
    margin-top: 15px;
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
    justify-content: center;
}
button {
    background: #2a2a4a;
    color: #e0e0e0;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
}
button:hover { background: #3a3a5a; }
button.active { background: #4a4a7a; border-color: #6a6aaa; }
input[type="range"] {
    width: 300px;
    accent-color: #a0c4ff;
}
.beat-display {
    font-size: 1.2em;
    font-variant-numeric: tabular-nums;
    min-width: 120px;
    text-align: center;
}
.speed-display { font-size: 0.9em; color: #888; }
.legend {
    margin-top: 10px;
    display: flex;
    gap: 20px;
    font-size: 0.85em;
}
.legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
}
.legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
}
.annotation {
    margin-top: 8px;
    font-size: 0.95em;
    color: #ccc;
    font-style: italic;
    min-height: 1.5em;
}
</style>
</head>
<body>
<h1>Contra Dance Visualizer</h1>
<canvas id="c" width="600" height="700"></canvas>
<div class="controls">
    <button id="playBtn" onclick="togglePlay()">▶ Play</button>
    <button onclick="stepBack()">◀ Step</button>
    <button onclick="stepFwd()">Step ▶</button>
    <input type="range" id="scrubber" min="0" max="1000" value="0" oninput="scrub(this.value)">
    <div class="beat-display" id="beatDisp">Beat 0.0</div>
</div>
<div class="controls">
    <span class="speed-display">Speed:</span>
    <button onclick="setSpeed(0.25)">0.25x</button>
    <button onclick="setSpeed(0.5)">0.5x</button>
    <button onclick="setSpeed(1)" class="active" id="speed1">1x</button>
    <button onclick="setSpeed(2)">2x</button>
    <button onclick="setSpeed(4)">4x</button>
</div>
<div class="legend">
    <div class="legend-item"><span class="legend-dot" style="background:#4a90d9"></span> Lark</div>
    <div class="legend-item"><span class="legend-dot" style="background:#d94a4a"></span> Robin</div>
    <div class="legend-item">
        <span style="color:#7a7">▲</span> Up (progressing north)
    </div>
    <div class="legend-item">
        <span style="color:#a77">▼</span> Down (progressing south)
    </div>
</div>
<div class="annotation" id="annotation"></div>

<script>
const KEYFRAMES = %%KEYFRAMES_JSON%%;
const DANCE_TITLE = "%%DANCE_TITLE%%";
const PROGRESSION_RATE = %%PROGRESSION_RATE%%;  // meters per beat (negative = camera pans south)

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const scrubber = document.getElementById('scrubber');
const beatDisp = document.getElementById('beatDisp');
const annotEl = document.getElementById('annotation');

// Animation state
let playing = false;
let speed = 1;  // beats per second
let currentBeat = KEYFRAMES.length > 0 ? KEYFRAMES[0].beat : 0;
let lastTimestamp = null;

const minBeat = KEYFRAMES.length > 0 ? KEYFRAMES[0].beat : 0;
const maxBeat = KEYFRAMES.length > 0 ? KEYFRAMES[KEYFRAMES.length - 1].beat : 64;

// Ghost trail: store recent positions
const trailLength = 20;
const trails = {};  // dancer_id -> [{x, y}, ...]

// Colors
const COLORS = {
    up_lark:    { fill: '#4a90d9', stroke: '#6ab0ff', label: 'UL' },
    up_robin:   { fill: '#d94a4a', stroke: '#ff6a6a', label: 'UR' },
    down_lark:  { fill: '#2a60a9', stroke: '#4a80c9', label: 'DL' },
    down_robin: { fill: '#a92a2a', stroke: '#c94a4a', label: 'DR' },
};

// Coordinate transform: world → canvas
const MARGIN = 40;
const Y_RANGE = 6;  // meters shown vertically
// Compute x range to give equal px/m in both axes
const usableW = canvas.width - 2 * MARGIN;
const usableH = canvas.height - 2 * MARGIN;
const pxPerMeter = usableH / Y_RANGE;
const X_RANGE = usableW / pxPerMeter;

// Camera: tracks the "down" dancers' progression (pans south over time)
let cameraY = 0;  // world y at the center of the viewport

function worldToCanvas(wx, wy) {
    const cx = MARGIN + (wx - (-X_RANGE / 2)) / X_RANGE * usableW;
    // y inverted: north (positive y) at top of screen, camera-relative
    const cy = MARGIN + ((cameraY + Y_RANGE / 2) - wy) / Y_RANGE * usableH;
    return [cx, cy];
}

function getFrameAtBeat(beat) {
    if (KEYFRAMES.length === 0) return null;
    if (beat <= KEYFRAMES[0].beat) return KEYFRAMES[0];
    if (beat >= KEYFRAMES[KEYFRAMES.length - 1].beat) return KEYFRAMES[KEYFRAMES.length - 1];

    // Binary search for surrounding frames
    let lo = 0, hi = KEYFRAMES.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (KEYFRAMES[mid].beat <= beat) lo = mid;
        else hi = mid;
    }

    const f0 = KEYFRAMES[lo];
    const f1 = KEYFRAMES[hi];
    const t = (beat - f0.beat) / (f1.beat - f0.beat);

    // Interpolate
    const frame = { beat: beat, dancers: {}, hands: f1.hands, annotation: f0.annotation || f1.annotation || '' };
    for (const id of Object.keys(f0.dancers)) {
        const d0 = f0.dancers[id];
        const d1 = f1.dancers[id];
        frame.dancers[id] = {
            x: d0.x + (d1.x - d0.x) * t,
            y: d0.y + (d1.y - d0.y) * t,
            facing: lerpAngle(d0.facing, d1.facing, t),
        };
    }
    return frame;
}

function lerpAngle(a, b, t) {
    let diff = ((b - a + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    return (a + diff * t + 360) % 360;
}

function drawFrame(frame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!frame) return;

    // Update camera: pan to track the "down" dancers' progression
    cameraY = PROGRESSION_RATE * frame.beat;

    const viewYMin = cameraY - Y_RANGE / 2;
    const viewYMax = cameraY + Y_RANGE / 2;

    // Draw grid lines (set lines) — full height of canvas
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (const x of [-0.5, 0.5]) {
        const [cx1, cy1] = worldToCanvas(x, viewYMax + 1);
        const [cx2, cy2] = worldToCanvas(x, viewYMin - 1);
        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        ctx.lineTo(cx2, cy2);
        ctx.stroke();
    }

    // Horizontal dividers between hands-fours — tile around camera
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#222';
    // Hands-fours repeat every 2m; find the nearest divider to the view
    const firstDivider = Math.floor((viewYMin - 1) / 2) * 2;
    for (let y = firstDivider; y <= viewYMax + 1; y += 2) {
        const [cx1, cy1] = worldToCanvas(-X_RANGE / 2, y);
        const [cx2, cy2] = worldToCanvas(X_RANGE / 2, y);
        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        ctx.lineTo(cx2, cy2);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw "up" arrow
    ctx.fillStyle = '#444';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const [arx, ary] = worldToCanvas(-X_RANGE / 2 + 0.15, viewYMax - 0.3);
    ctx.fillText('↑ up', arx, ary);

    // Draw hand connections
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    for (const h of (frame.hands || [])) {
        const da = frame.dancers[h.a];
        const db = frame.dancers[h.b];
        if (da && db) {
            drawHandsForAllCopies(da, h.ha, db, h.hb);
        }
    }

    // Draw dancers: tile copies every 2m to fill the viewport
    const firstCopy = Math.floor((viewYMin - 1) / 2) * 2;
    const lastCopy = Math.ceil((viewYMax + 1) / 2) * 2;
    for (let offset = firstCopy; offset <= lastCopy; offset += 2) {
        for (const [id, d] of Object.entries(frame.dancers)) {
            drawDancer(id, d.x, d.y + offset, d.facing, 1.0);
        }
    }

    // Update trail
    for (const [id, d] of Object.entries(frame.dancers)) {
        if (!trails[id]) trails[id] = [];
        trails[id].push({ x: d.x, y: d.y });
        if (trails[id].length > trailLength) trails[id].shift();
    }

    // Draw trails (only for main copy)
    for (const [id, trail] of Object.entries(trails)) {
        const color = COLORS[id];
        if (!color) continue;
        ctx.strokeStyle = color.fill;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
            const [tcx, tcy] = worldToCanvas(trail[i].x, trail[i].y);
            if (i === 0) ctx.moveTo(tcx, tcy);
            else ctx.lineTo(tcx, tcy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }

    // Draw hands for copies too
    for (const h of (frame.hands || [])) {
        const da = frame.dancers[h.a];
        const db = frame.dancers[h.b];
        if (da && db) {
            drawHandsForAllCopies(da, h.ha, db, h.hb);
        }
    }

    // Beat display
    beatDisp.textContent = `Beat ${frame.beat.toFixed(1)}`;
    annotEl.textContent = frame.annotation || '';

    // Scrubber
    const pct = (frame.beat - minBeat) / (maxBeat - minBeat) * 1000;
    scrubber.value = Math.round(pct);
}

function handAnchorOffset(facing, hand, r) {
    // Compute canvas-pixel offset for a hand anchor point on the circle edge.
    // "right" = 90° clockwise from facing; "left" = 90° counter-clockwise.
    const fRad = facing * Math.PI / 180;
    const sign = (hand === 'right') ? 1 : -1;
    // On canvas: right of facing direction
    //   dx = cos(facing) * sign * r
    //   dy = sin(facing) * sign * r   (canvas y is inverted from world y)
    return [Math.cos(fRad) * sign * r, Math.sin(fRad) * sign * r];
}

function drawHandsForAllCopies(da, handA, db, handB) {
    const viewYMin = cameraY - Y_RANGE / 2;
    const viewYMax = cameraY + Y_RANGE / 2;
    const firstCopy = Math.floor((viewYMin - 1) / 2) * 2;
    const lastCopy = Math.ceil((viewYMax + 1) / 2) * 2;
    const r = 14;  // dancer circle radius in pixels
    const [dxA, dyA] = handAnchorOffset(da.facing, handA, r);
    const [dxB, dyB] = handAnchorOffset(db.facing, handB, r);
    for (let offset = firstCopy; offset <= lastCopy; offset += 2) {
        ctx.globalAlpha = 1.0;
        const [ax, ay] = worldToCanvas(da.x, da.y + offset);
        const [bx, by] = worldToCanvas(db.x, db.y + offset);
        ctx.beginPath();
        ctx.moveTo(ax + dxA, ay + dyA);
        ctx.lineTo(bx + dxB, by + dyB);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
}

function drawDancer(id, x, y, facing, alpha) {
    const color = COLORS[id];
    if (!color) return;

    const [cx, cy] = worldToCanvas(x, y);
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
    const fRad = (facing - 90) * Math.PI / 180;  // convert: 0°=up → canvas angle
    // In our coord system, facing 0° = north = up on screen
    // Canvas: 0 rad = right. So north = -π/2
    const arrowAngle = -(facing * Math.PI / 180) + Math.PI / 2;
    // Actually: facing 0° = north (up on screen). On canvas, "up" is -y.
    // Arrow from center pointing in facing direction:
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

function togglePlay() {
    playing = !playing;
    document.getElementById('playBtn').textContent = playing ? '⏸ Pause' : '▶ Play';
    if (playing) {
        lastTimestamp = null;
        requestAnimationFrame(animate);
    }
}

function animate(timestamp) {
    if (!playing) return;
    if (lastTimestamp === null) lastTimestamp = timestamp;

    const dt = (timestamp - lastTimestamp) / 1000;  // seconds
    lastTimestamp = timestamp;

    currentBeat += dt * speed * 4;  // 4 beats per second at 1x speed
    if (currentBeat > maxBeat) {
        currentBeat = minBeat;
        // Clear trails on loop
        for (const id of Object.keys(trails)) trails[id] = [];
    }

    const frame = getFrameAtBeat(currentBeat);
    drawFrame(frame);

    requestAnimationFrame(animate);
}

function scrub(val) {
    const pct = val / 1000;
    currentBeat = minBeat + pct * (maxBeat - minBeat);
    const frame = getFrameAtBeat(currentBeat);
    drawFrame(frame);
    // Clear trails when scrubbing
    for (const id of Object.keys(trails)) trails[id] = [];
}

function stepFwd() {
    currentBeat = Math.min(currentBeat + 0.25, maxBeat);
    const frame = getFrameAtBeat(currentBeat);
    drawFrame(frame);
}

function stepBack() {
    currentBeat = Math.max(currentBeat - 0.25, minBeat);
    const frame = getFrameAtBeat(currentBeat);
    drawFrame(frame);
}

function setSpeed(s) {
    speed = s;
    document.querySelectorAll('.controls button').forEach(b => {
        if (b.textContent.includes('x')) b.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Initial draw
if (KEYFRAMES.length > 0) {
    drawFrame(getFrameAtBeat(minBeat));
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); stepFwd(); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); stepBack(); }
});
</script>
</body>
</html>"""


def render_html(
    keyframes: list[Keyframe],
    output_path: str | Path,
    title: str = "Contra Dance",
    progression_rate: float = -1.0 / 64,
) -> Path:
    """Render keyframes to a self-contained HTML file.

    Args:
        keyframes: List of animation keyframes.
        output_path: Where to write the HTML file.
        title: Dance title shown in the header.
        progression_rate: Camera pan speed in meters/beat. Negative = south.
            Default: -1/64 (single progression, tracking "down" dancers).

    Returns:
        Path to the written HTML file.
    """
    output_path = Path(output_path)
    kf_json = keyframes_to_json(keyframes)
    html = _HTML_TEMPLATE.replace("%%KEYFRAMES_JSON%%", kf_json)
    html = html.replace("%%DANCE_TITLE%%", title)
    html = html.replace("%%PROGRESSION_RATE%%", str(progression_rate))
    output_path.write_text(html)
    return output_path
