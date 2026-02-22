# Draggable Number Handles

*2026-02-22T01:08:42Z by Showboat 0.6.0*
<!-- showboat-id: a533510f-900b-4418-b97f-0505ac417505 -->

Small draggable grip handles now appear after every number input in the instruction editor. Click-and-drag horizontally to adjust values: drag right to increase, left to decrease. Increments are 0.5 for beat counts, 0.25 for rotations, 0.5 for distances, and 1 for progression. On mobile, touch-and-drag works and overrides scroll behavior only when the touch starts on a handle.

## Default view with dance loaded

```bash {image}
demos/drag-number-handles/screenshot-1.png
```

![ec9b8a1e-2026-02-22](ec9b8a1e-2026-02-22.png)

## Close-up: drag handles on instruction row

Each number input has a small grip handle (two vertical lines) to its right. The handle shows cursor: ew-resize on hover.

```bash {image}
demos/drag-number-handles/screenshot-2.png
```

![4ba1f909-2026-02-22](4ba1f909-2026-02-22.png)

## Progression input also has a drag handle

```bash {image}
demos/drag-number-handles/screenshot-3.png
```

![1b2d6e21-2026-02-22](1b2d6e21-2026-02-22.png)

## Dance with rotation fields (Otter's Allemande)

Rotation fields (e.g. allemande, circle, do-si-do) use 0.25 step increments. Beat fields use 0.5 step increments.

```bash {image}
demos/drag-number-handles/screenshot-4.png
```

![617192ea-2026-02-22](617192ea-2026-02-22.png)

```bash
npx vitest run 2>&1 | tail -8
```

```output
 [32m✓[39m src/figures/balance/balance.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 10[2mms[22m[39m
 [32m✓[39m src/SearchableDropdown.test.tsx [2m([22m[2m24 tests[22m[2m)[22m[33m 861[2mms[22m[39m

[2m Test Files [22m [1m[32m21 passed[39m[22m[90m (21)[39m
[2m      Tests [22m [1m[32m189 passed[39m[22m[90m (189)[39m
[2m   Start at [22m 01:11:36
[2m   Duration [22m 6.31s[2m (transform 4.92s, setup 0ms, import 12.28s, tests 1.16s, environment 3.98s)[22m

```

```bash
npx tsc --noEmit 2>&1 | tail -3
```

```output
```
