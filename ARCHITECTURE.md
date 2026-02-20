# Architecture

Contravis3 is a browser-based visualizer and editor for contra dance choreography. It lets users build a sequence of dance instructions, generates keyframe animations from them, and renders the result on an HTML canvas. There is also a CLI for building dance JSON files and exporting GIFs.

## Tech stack

- **TypeScript** throughout (strict, with Zod for runtime schema validation)
- **React 19** for the UI, bootstrapped with **Vite**
- **Vitest** for unit tests, **Playwright** for E2E tests
- **gifenc** for GIF encoding
- **@dnd-kit** for drag-and-drop reordering of instructions
- No server component; the app runs entirely in the browser

## Directory layout

```
src/
  types.ts          Core domain types and Zod schemas
  generate.ts       Keyframe generation engine (instructions -> keyframes)
  renderer.ts       Canvas rendering (keyframes -> pixels) + interpolation
  exportGif.ts      GIF encoding using gifenc
  App.tsx           Top-level React component (canvas + playback controls)
  CommandPane.tsx   Instruction editor sidebar (forms, drag-and-drop, JSON I/O)
  SearchableDropdown.tsx  Reusable filterable dropdown widget
  main.tsx          React entry point
  utils.ts          Utility (just assertNever)

scripts/
  choreo.ts         CLI for creating/editing dance JSON files
  dance-to-gif.ts   CLI for rendering a dance JSON to an animated GIF

example-dances/    Sample dance JSON files (e.g. "Into the Spaghetti Bowl")
demos/             Screenshots and demo assets
e2e/               Playwright end-to-end tests
```

## Core concepts

These are the contra-dance-specific terms that map directly to types in the code. See `CONTRA.md` for the full dance reference.

### Dancers

Every dancer has a **role** (lark or robin) and a **progression direction** (up or down). A contra dance set has perfect translational symmetry: the entire set is four **prototypical dancers** (`up_lark_0`, `up_robin_0`, `down_lark_0`, `down_robin_0`) copy-pasted every 2 meters along the hall. The `ProtoDancerId` type represents one of these four; `DancerId` adds an integer offset (e.g. `down_robin_1`) to reference a copy in an adjacent hands-four.

### DancerState and Keyframe

A `DancerState` is `{ x, y, facing }` where x is across the set (west = -0.5, east = 0.5), y is along the set (up = positive), and facing is in degrees (0 = north/up, 90 = east). A `Keyframe` captures the state of all four proto-dancers at a specific beat, plus a list of `HandConnection`s (which dancer's which hand is holding which other dancer's which hand).

### Relationships

Dancers interact via **relationships**: `partner` (same direction, other role), `neighbor` (other direction, other role), `opposite` (other direction, same role). There are also spatial relationships like `on_right`, `on_left`, `in_front` that are resolved dynamically based on current positions and facings.

### Instructions

Instructions are the units of choreography. The `Instruction` type is a recursive discriminated union:

- **Atomic instructions** (`AtomicInstruction`): a single dance figure with a `type`, `beats`, and figure-specific parameters. Types include `allemande`, `swing`, `do_si_do`, `pull_by`, `circle`, `balance`, `step`, `turn`, `take_hands`, `drop_hands`, `box_the_gnat`, `give_and_take_into_swing`, and `mad_robin`.
- **Split**: two parallel sub-sequences executed simultaneously by different groups, split either by `role` (larks do X, robins do Y) or by `position` (ups do X, downs do Y). Sub-instructions inside a split must be atomic.
- **Group**: a labeled container of child `Instruction`s (which can themselves be splits, groups, or atomics). Used for organizational purposes (e.g. "A1: long lines forward & back").

Each instruction has a UUID `id` used for referencing it in the UI, error reporting, and validation.

### Dance

A `Dance` is the top-level object: `{ name?, author?, initFormation, progression, instructions }`. The `initFormation` is either `improper` or `beckett`, defining where dancers start. The `progression` (typically 1) is how many meters each dancer moves in their direction per 64-beat cycle.

## Data flow

```
Dance JSON (or UI edits)
        |
        v
  [Instruction[]]
        |
        v
  generateAllKeyframes()     <-- generate.ts
        |
        v
  Keyframe[]  (sparse: one per sub-beat of motion)
        |
        v
  getFrameAtBeat()           <-- renderer.ts (interpolation + smoothing)
        |
        v
  Keyframe  (single interpolated frame)
        |
        v
  Renderer.drawFrame()       <-- renderer.ts (canvas drawing)
        |
        v
  <canvas> pixels
```

## Keyframe generation (`generate.ts`)

This is the core engine. `generateAllKeyframes()` takes an instruction list and an initial formation, produces a starting keyframe from `initialKeyframe()`, then walks the instruction tree:

1. **Atomic instructions** are dispatched to per-type generator functions (`generateAllemande`, `generateSwing`, `generateStep`, etc.). Each takes the previous keyframe, the instruction, and a **scope** (which of the four proto-dancers are affected), and returns an array of new keyframes.

2. **Splits** generate two independent timelines (one per group), then merge them at `mergeSplitTimelines()`. Each timeline only moves dancers within its scope; the merge produces keyframes at every beat that appears in either timeline, sampling each from the appropriate sub-timeline.

3. **Groups** process child instructions sequentially, threading the last keyframe of each child as the starting keyframe for the next.

### Relationship resolution

`resolveRelationship()` maps a `Relationship` to the target `DancerId`. Static relationships (partner, neighbor, opposite) are hardcoded lookup tables. Spatial relationships (on_right, on_left, in_front) use a scoring function based on angular proximity to the dancer's facing direction, searching nearby proto-dancers at various offsets.

`resolvePairs()` resolves a relationship for all scoped dancers and validates symmetry (if A's neighbor is B, then B's neighbor must be A).

### Motion generation

Most generator functions follow the same pattern:
1. Resolve pairs or targets from the previous keyframe's positions.
2. Compute orbital/displacement parameters (center, radius, start angle, etc.).
3. Generate N sub-beat frames (typically one per 0.25 beats) with eased interpolation (`easeInOut` = cosine ease).
4. Return the array of keyframes.

Notable generators:
- **Swing** has two phases: regular spinning orbit, then a "peel-off" phase in the last ~90 degrees where the pair separates to face a specified direction side by side.
- **Give-and-take into swing**: a walk phase (drawee walks halfway to drawer) followed by a swing with center-of-mass drift toward the final position.
- **Circle**: all scoped dancers orbit their common center, with ring hand connections automatically computed.
- **Do-si-do**: like an allemande orbit but dancers maintain their original facing direction (no rotation) and follow an elliptical path.

### Validation

After generation, two validators can run:
- `validateHandDistances()`: warns if holding-hands dancers are ever more than 1.2m apart.
- `validateProgression()`: checks that after 64 beats each dancer has moved exactly `progression` meters in their direction.

### Error handling

`KeyframeGenerationError` carries `partialKeyframes` so the UI can still render everything up to the point of failure. The error's `instructionId` identifies which instruction caused the problem. Instructions after the error are visually dimmed in the UI.

## Rendering (`renderer.ts`)

The `Renderer` class draws onto a 2D canvas:
- A fixed pixel-per-meter scale with a camera that pans vertically to follow progression.
- Two vertical lines at x = +/-0.5 (the "set" boundaries) and dashed horizontal dividers every 2m (hands-four boundaries).
- Each proto-dancer drawn as a colored circle with a facing arrow and a two-letter label (UL, UR, DL, DR). Blue for larks, red for robins; lighter shades for "up" dancers, darker for "down."
- Dancers are tiled every 2m to fill the viewport; the primary copy (offset 0) is at full opacity, copies are at 0.35 opacity.
- Hand connections rendered as lines between hand anchor points.
- Short trails (last 20 positions) drawn behind each dancer.
- Ghost dancers (semi-transparent) for previewing where an instruction will move dancers.

### Interpolation

`getFrameAtBeat()` provides smooth playback:
- `rawFrameAtBeat()` does linear interpolation between the two surrounding keyframes (binary search), with angle-aware lerp for facing. It handles cycle wrapping and applies progression offsets for multi-cycle playback.
- When `smoothness > 0`, a moving-average window samples 10 raw frames and averages positions/facings, producing smoother motion at the cost of slight lag.

## UI layer

### App (`App.tsx`)

The root component manages:
- A canvas (left/top) with the `Renderer`.
- A sidebar (right/bottom on mobile) with `CommandPane`.
- Playback state: play/pause, beat counter, BPM slider, smoothness slider, scrubber.
- An animation loop via `requestAnimationFrame`.
- GIF export (renders to an offscreen canvas, encodes via `exportGif()`).
- Keyboard shortcuts: Space (play/pause), Arrow keys (step forward/back).
- Edit-mode integration: when the user edits an instruction in the sidebar, playback pauses and scrubs to that instruction's start beat, and ghost preview keyframes are overlaid on the canvas.

### CommandPane (`CommandPane.tsx`)

The instruction editor panel:
- Renders the instruction tree as a nested list with drag-and-drop reordering (via @dnd-kit).
- Each instruction shows a one-line summary; clicking the edit button opens an `InlineForm` with fields specific to that instruction type (e.g. relationship dropdown, beats input, rotation count).
- "+" buttons between instructions open an insert form.
- Splits render two sub-lists (e.g. "Larks" / "Robins"), each independently sortable.
- Groups render their children indented and recursively.
- JSON import/export: "Copy JSON" serializes the dance; a paste-target textarea accepts dance JSON.
- Example dances can be loaded from a dropdown (files in `example-dances/` are imported at build time via `import.meta.glob`).
- Live preview: as the user edits an instruction's parameters, `useInstructionPreview` parses the form state into an `Instruction` and passes it up to `App`, which generates and overlays preview keyframes.
- Validation feedback: hand-distance warnings and generation errors are shown inline next to the offending instruction. Instructions after an error are dimmed.

### SearchableDropdown (`SearchableDropdown.tsx`)

A reusable combobox component with keyboard navigation, type-ahead filtering, and an optional label mapping. Used throughout `CommandPane` for selecting relationships, directions, hands, action types, etc.

## CLI tools

### `scripts/choreo.ts`

A command-line interface for non-interactive dance building. Subcommands:
- `init`: create a new dance JSON file.
- `insert`: add an instruction to an existing dance file (with `--before`/`--after` positioning).
- `inspect`: show the dancer state at a specific beat or instruction boundary.
- `validate`: run all validators on a dance file.
- `list`: print the instruction tree with beat numbers.

### `scripts/dance-to-gif.ts`

Renders a dance JSON file to an animated GIF using a Node.js `canvas` polyfill, reusing the same `Renderer` and `exportGif` code as the browser.
