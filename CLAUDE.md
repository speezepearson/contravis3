# Development

- Type-check: `npm run typecheck` (not `npx tsc --noEmit`, which silently checks nothing due to project references)
- Test: `npm test` or `npx vitest run`
- Build: `npm run build`
- Make good use of `assertNever()`.