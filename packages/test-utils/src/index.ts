export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const intervalMs = options.intervalMs ?? 250;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value != null) return value;
    await sleep(intervalMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}
