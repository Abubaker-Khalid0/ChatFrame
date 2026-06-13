/**
 * Tiny bounded-parallelism pool (FR-028; research §3).
 *
 * Runs `worker` over `items` with at most `limit` invocations in flight at
 * once. Implemented in-repo instead of adding `p-limit`/`p-map`
 * (Constitution XXII — dependency hygiene). Worker failures never abort the
 * pool: every item settles, and each outcome is reported through `onSettled`
 * and the returned array (no silent data loss, Constitution XXIII).
 */

/** The settled outcome of one item. */
export type SettledResult<R> = { ok: true; value: R } | { ok: false; error: unknown };

export interface RunWithConcurrencyOptions<T, R> {
  /** Invoked as each item settles (success or failure), in completion order. */
  onSettled?: (item: T, result: SettledResult<R>, index: number) => void;
}

/** Default download parallelism (FR-028). */
export const DEFAULT_CONCURRENCY = 5;

/**
 * Processes every item with bounded parallelism and returns the settled
 * results in item order.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  options: RunWithConcurrencyOptions<T, R> = {},
): Promise<SettledResult<R>[]> {
  const results: SettledResult<R>[] = new Array<SettledResult<R>>(items.length);
  if (items.length === 0) {
    return results;
  }

  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  const runner = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index] as T;
      let result: SettledResult<R>;
      try {
        result = { ok: true, value: await worker(item, index) };
      } catch (error) {
        result = { ok: false, error };
      }
      results[index] = result;
      options.onSettled?.(item, result, index);
    }
  };

  await Promise.all(Array.from({ length: effectiveLimit }, () => runner()));
  return results;
}
