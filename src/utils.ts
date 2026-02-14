export function assertNever(x: never, msg?: string): never {
  throw new Error(msg ?? `value ${x} should be impossible`);
}
