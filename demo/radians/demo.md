# Refactor: Degrees to Radians

*2026-02-20T12:19:10Z by Showboat 0.6.0*
<!-- showboat-id: b1299713-97a5-4ac1-a212-3b10930d2f98 -->

All angles in this codebase have been refactored from **degrees** to **radians** internally. The UI now displays angles in **rotations** (1 rot = 360° = 2π rad). Named constants replace magic numbers: `NORTH=0`, `EAST=π/2`, `SOUTH=π`, `WEST=3π/2`, plus rotation constants like `QUARTER_CW`, `HALF_CW`, `FULL_CW`, and their CCW counterparts.

## Verification: All tests pass

```bash
npx vitest run 2>&1 | tail -8
```

```output
 [32m✓[39m src/generate.test.ts [2m([22m[2m119 tests[22m[2m)[22m[32m 68[2mms[22m[39m
 [32m✓[39m src/SearchableDropdown.test.tsx [2m([22m[2m24 tests[22m[2m)[22m[33m 833[2mms[22m[39m

[2m Test Files [22m [1m[32m5 passed[39m[22m[90m (5)[39m
[2m      Tests [22m [1m[32m174 passed[39m[22m[90m (174)[39m
[2m   Start at [22m 12:19:44
[2m   Duration [22m 5.54s[2m (transform 897ms, setup 0ms, import 2.61s, tests 966ms, environment 3.41s)[22m

```

## Keyframe comparison: Only facing values changed (degrees → radians)

```bash
npx tsx save-keyframes.ts 2>&1
```

```output
Saved 271 keyframes to /tmp/keyframes-after.json

Comparison results:
  Non-facing diffs: 0
  Max facing conversion error: 0.000e+0
  ✓ All positions match; facings are correctly converted from degrees to radians
```

## Angle constants defined in types.ts

```bash
grep -A 15 'Cardinal bearings' src/types.ts
```

```output
/** Cardinal bearings (absolute directions). */
export const NORTH = 0;
export const EAST = Math.PI / 2;
export const SOUTH = Math.PI;
export const WEST = 3 * Math.PI / 2;

/** Rotation amounts. */
export const QUARTER_CW = Math.PI / 2;
export const HALF_CW = Math.PI;
export const FULL_CW = 2 * Math.PI;
export const QUARTER_CCW = -Math.PI / 2;
export const HALF_CCW = -Math.PI;
export const FULL_CCW = -2 * Math.PI;

/** Normalize a bearing into [0, 2π). */
export function normalizeBearing(bearing: number): number {
```

## UI screenshots

```bash {image}
demo/radians/otters-allemande-loaded.png
```

![2657bf9d-2026-02-20](2657bf9d-2026-02-20.png)

```bash {image}
demo/radians/mid-dance.png
```

![3cc772ab-2026-02-20](3cc772ab-2026-02-20.png)

## Build check

```bash
npx tsc --noEmit 2>&1 | tail -3
```

```output
```
