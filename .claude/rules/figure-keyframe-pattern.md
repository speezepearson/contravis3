When editing files in `src/figures/`:

Each figure module exports two functions:

1. `final*(prev: Keyframe, instr, scope) -> FinalKeyframe` — computes **only** the authoritative final state of the figure. This is the single source of truth for where dancers end up.

2. `generate*(prev: Keyframe, final: FinalKeyframe, instr, scope) -> KeyframeFn | Keyframe[]` — computes **only** the intermediate keyframes (not including the final). It receives the pre-computed `FinalKeyframe` as a parameter. Most figures return a `KeyframeFn` — a function `(t: number) => Keyframe` where `t` is a normalized parameter in (0, 1) representing progress through the figure. Figures that are inherently discrete (e.g., balance) or composite (e.g., rightLeftThrough) may still return `Keyframe[]`.

The orchestrator in `generate.ts` calls `final*` first, then `generate*`, samples the `KeyframeFn` at regular intervals if needed (via `sampleIntermediates`), and combines them: `[...intermediates, final]`.

**Why this pattern matters:** In contra dance, what matters most is ending up at the right place at the end of each figure. By computing the final state independently and authoritatively, bugs in intermediate keyframe generation can never corrupt the rest of the dance. The `FinalKeyframe` branded type (via `z.BRAND`) enforces at the type level that you cannot compute intermediates without first computing the final.

Figures that don't need the `FinalKeyframe` for interpolation (e.g., orbit-based figures like allemande, circle) still accept it as a parameter to maintain the contract.
