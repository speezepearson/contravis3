# Fix: Mobile instruction drawer no longer blocks Hide button

*2026-02-22T20:00:19Z by Showboat 0.6.0*
<!-- showboat-id: e4d8ea9e-268d-4770-a26e-80da253680b7 -->

On mobile, the instruction drawer (position: fixed, z-index: 10) was stacking on top of the mobile controls when opened, making the Hide Instructions toggle button unclickable. Fixed by giving .mobile-controls position: relative and z-index: 20 so it stays above the drawer.

## Step 1: Mobile view — controls and Show Instructions button visible

```bash {image}
demos/fix-drawer-zindex/screenshot-1.png
```

![ff19d4b5-2026-02-22](ff19d4b5-2026-02-22.png)

## Step 2: Drawer open — instructions visible, Hide button still clickable

```bash {image}
demos/fix-drawer-zindex/screenshot-2.png
```

![0e377ecf-2026-02-22](0e377ecf-2026-02-22.png)

## Step 3: After clicking Hide — drawer closes successfully

```bash {image}
demos/fix-drawer-zindex/screenshot-3.png
```

![95f7f88d-2026-02-22](95f7f88d-2026-02-22.png)

```bash
npx vitest run 2>&1 | tail -8
```

```output
 [32m✓[39m src/figures/circle/circle.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 11[2mms[22m[39m
 [32m✓[39m src/SearchableDropdown.test.tsx [2m([22m[2m24 tests[22m[2m)[22m[33m 903[2mms[22m[39m

[2m Test Files [22m [1m[32m21 passed[39m[22m[90m (21)[39m
[2m      Tests [22m [1m[32m189 passed[39m[22m[90m (189)[39m
[2m   Start at [22m 20:01:19
[2m   Duration [22m 7.07s[2m (transform 5.73s, setup 0ms, import 14.69s, tests 1.23s, environment 4.46s)[22m

```

```bash
npx tsc --noEmit 2>&1 | tail -3
```

```output
```
