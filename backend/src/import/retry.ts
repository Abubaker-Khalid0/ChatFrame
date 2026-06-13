/**
 * Exponential-backoff retry (FR-027; research §4).
 *
 * Attempts `fn` once and retries on failure up to `delaysMs.length` times,
 * waiting the corresponding delay before each retry (default 1s, 2s, 4s per
 * the spec clarification). The first success wins; after exhaustion the last
 * error is thrown. `sleep` is injectable so tests run instantly
 * (Constitution XX). Implemented in-repo instead of adding `p-retry`
 * (Constitution XXII).
 */

/** The spec-fixed retry schedule: 3 retries at 1s, 2s, 4s (FR-027). */
export const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 4_000];

export interface RetryOptions {
  /** Wait before each retry; the array length is the retry count. */
  delaysMs?: readonly number[];
  /** Injectable delay so tests run without real waits. */
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `fn`, retrying per the backoff schedule; throws the last error. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const delays = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (attempt > 0) {
      await sleep(delays[attempt - 1] as number);
    }
    try {
      return await fn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
