# New Figures: Short Waves, Long Waves, Long Lines

*2026-02-22T00:06:17Z by Showboat 0.6.0*
<!-- showboat-id: a6533ee8-6ad2-4867-af39-6d27db1f57aa -->

Three new formation-assertion figures added: **short waves**, **long waves**, and **long lines forward and back**. Short waves and long waves are 0-beat assertion figures that validate dancer positions and take inside hands. Long lines is an 8-beat figure that also steps dancers toward and away from the center of the set.

## Short Waves

Dancers do-si-do their neighbor 1¼, ending in short wavy lines. The **short_waves** figure asserts each dancer's left/right neighbors face the opposite direction, have roughly the same y-coordinate, and takes inside hands. If holding hands with exactly one person, asserts opposite role. Replaces the take_hands + split pattern previously used in otters-allemande.

```bash {image}
demos/new-figures/short-waves.gif
```

![fa80a033-2026-02-22](fa80a033-2026-02-22.gif)

## Long Waves

Starting in Beckett formation, larks turn 180°. The **long_waves** figure asserts every dancer has someone on both left and right, facing opposite direction, same x-coordinate, opposite role — then takes inside hands. Followed by a balance right.

```bash {image}
demos/new-figures/long-waves.gif
```

![b9abaf03-2026-02-22](b9abaf03-2026-02-22.gif)

## Long Lines Forward and Back

Starting in Beckett formation (already a long lines formation), the **long_lines** figure asserts neighbors on both sides face the same direction, same x-coordinate, opposite role — takes inside hands, then steps toward the middle of the set (x=±0.2) and back (x=±0.5) over 8 beats.

```bash {image}
demos/new-figures/long-lines.gif
```

![fac9ad25-2026-02-22](fac9ad25-2026-02-22.gif)

```bash
npx vitest run 2>&1 | tail -8
```

```output
 [32m✓[39m src/figures/balance/balance.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/SearchableDropdown.test.tsx [2m([22m[2m24 tests[22m[2m)[22m[33m 839[2mms[22m[39m

[2m Test Files [22m [1m[32m21 passed[39m[22m[90m (21)[39m
[2m      Tests [22m [1m[32m189 passed[39m[22m[90m (189)[39m
[2m   Start at [22m 00:07:30
[2m   Duration [22m 5.99s[2m (transform 5.09s, setup 0ms, import 11.32s, tests 1.15s, environment 3.77s)[22m

```

```bash
npx tsc --noEmit 2>&1 | tail -3
```

```output
```
