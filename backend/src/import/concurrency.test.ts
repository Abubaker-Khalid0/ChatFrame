import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './concurrency';

/** A promise the test resolves manually. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('runWithConcurrency (FR-028; research §3)', () => {
  it('never exceeds the concurrency limit (peak assertion)', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let active = 0;
    let peak = 0;

    await runWithConcurrency(items, 5, async () => {
      active += 1;
      peak = Math.max(peak, active);
      // Yield to the event loop so other workers can start.
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
    });

    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });

  it('processes every item and returns settled results in item order', async () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const seen: string[] = [];

    const results = await runWithConcurrency(items, 3, async (item) => {
      seen.push(item);
      return item.toUpperCase();
    });

    expect(seen.sort()).toEqual([...items].sort());
    expect(results).toEqual(items.map((item) => ({ ok: true, value: item.toUpperCase() })));
  });

  it('continues past worker failures and reports them via onSettled', async () => {
    const failures: number[] = [];
    const results = await runWithConcurrency(
      [1, 2, 3, 4],
      2,
      async (item) => {
        if (item % 2 === 0) {
          throw new Error(`fail-${item}`);
        }
        return item;
      },
      {
        onSettled: (item, result) => {
          if (!result.ok) {
            failures.push(item);
          }
        },
      },
    );

    expect(failures.sort()).toEqual([2, 4]);
    expect(results[0]).toEqual({ ok: true, value: 1 });
    expect(results[1]?.ok).toBe(false);
    expect(results[3]?.ok).toBe(false);
  });

  it('starts no more workers than items and handles an empty list', async () => {
    expect(await runWithConcurrency([], 5, async () => 'x')).toEqual([]);

    // With 2 items and limit 5, both can run but nothing beyond them starts.
    const first = deferred();
    let started = 0;
    const run = runWithConcurrency([1, 2], 5, async () => {
      started += 1;
      await first.promise;
    });
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(started).toBe(2);
    first.resolve();
    await run;
  });
});
