# Mobile: two-mode layout (compact controls vs full-screen editor)

*2026-02-22T20:09:37Z by Showboat 0.6.0*
<!-- showboat-id: f5b0a64c-4cf1-4925-9246-0ea05e5863ce -->

Replaced the old overlay drawer with two mutually exclusive mobile modes: a compact controls bar (play, scrubber, BPM, GIF export, Edit Instructions button) and a full-screen instruction editor. Step buttons and the lark/robin/up/down legend are removed from mobile.

## Compact controls mode

```bash {image}
demos/fix-drawer-zindex/screenshot-1.png
```

![e1d5da35-2026-02-22](e1d5da35-2026-02-22.png)

## Full-screen instruction editor (after tapping Edit Instructions)

```bash {image}
demos/fix-drawer-zindex/screenshot-2.png
```

![af554fbe-2026-02-22](af554fbe-2026-02-22.png)

## Back to visualization (after tapping Back to Visualization)

```bash {image}
demos/fix-drawer-zindex/screenshot-3.png
```

![85dfa3e2-2026-02-22](85dfa3e2-2026-02-22.png)

```bash
npx vitest run 2>&1 | tail -8
```

```output
 [32m✓[39m src/figures/longWaves/longWaves.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/SearchableDropdown.test.tsx [2m([22m[2m24 tests[22m[2m)[22m[33m 978[2mms[22m[39m

[2m Test Files [22m [1m[32m21 passed[39m[22m[90m (21)[39m
[2m      Tests [22m [1m[32m189 passed[39m[22m[90m (189)[39m
[2m   Start at [22m 20:10:19
[2m   Duration [22m 8.72s[2m (transform 7.01s, setup 0ms, import 18.27s, tests 1.36s, environment 5.45s)[22m

```

```bash
npx tsc --noEmit 2>&1 | tail -3
```

```output
```
