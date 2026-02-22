# Fix Mobile UI Layout

*2026-02-22T04:02:31Z by Showboat 0.6.0*
<!-- showboat-id: 6520138f-b321-4c42-9ff2-447cbf37f8cb -->

On mobile viewports (411×789), the playback controls were clipped off the bottom of the screen by the canvas, and the 'Show Instructions' button was inaccessible. This fix adds `flex-shrink: 0` to `.mobile-controls` and `overflow: hidden` to `.vis-column` on mobile, ensuring controls always remain visible and the instruction drawer can be opened.

## Drawer Closed (411×789)

Controls are fully visible at the bottom of the viewport. Play/Step/GIF buttons, scrubber, BPM, smoothness slider, legend, and the 'Show Instructions' toggle are all accessible.

```bash {image}
demos/fix-mobile-layout/mobile-drawer-closed.png
```

![75e7f076-2026-02-22](75e7f076-2026-02-22.png)

## Drawer Open (411×789)

Tapping 'Show Instructions' opens the instruction drawer as a bottom sheet (max 60vh). The dance loader, formation selector, instruction list, and JSON import/export are all accessible.

```bash {image}
demos/fix-mobile-layout/mobile-drawer-open.png
```

![c498d5c7-2026-02-22](c498d5c7-2026-02-22.png)

```bash
npx vitest run 2>&1 | tail -8
```

```output
 [32m✓[39m src/figures/longWaves/longWaves.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m src/SearchableDropdown.test.tsx [2m([22m[2m24 tests[22m[2m)[22m[33m 799[2mms[22m[39m

[2m Test Files [22m [1m[32m21 passed[39m[22m[90m (21)[39m
[2m      Tests [22m [1m[32m189 passed[39m[22m[90m (189)[39m
[2m   Start at [22m 04:03:31
[2m   Duration [22m 5.62s[2m (transform 5.02s, setup 0ms, import 11.36s, tests 1.06s, environment 3.52s)[22m

```

```bash
npx tsc --noEmit 2>&1 | tail -3
```

```output
```
