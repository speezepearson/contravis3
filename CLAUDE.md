# CLAUDE.md

## Build & Test

- `npm run build` — type-check and build
- `npm test` — run all tests (vitest)

## Code Patterns

### Exhaustiveness checking

When switching/branching on a discriminated union or enum-like type, always ensure exhaustiveness using `assertNever` (from `src/utils.ts`). This catches missing cases at compile time when new variants are added.

In a switch statement, add a `default` case:

```ts
switch (instr.type) {
  case 'foo': return handleFoo(instr);
  case 'bar': return handleBar(instr);
  default: return assertNever(instr);
}
```

In a ternary/if-else chain, end with `assertNever`:

```ts
const result =
  x === 'a' ? handleA() :
  x === 'b' ? handleB() :
  assertNever(x);
```

In JSX, use an IIFE switch:

```tsx
{(() => { switch (action) {
  case 'foo': return <FooFields />;
  case 'bar': return <BarFields />;
  default: assertNever(action);
}})()}
```
