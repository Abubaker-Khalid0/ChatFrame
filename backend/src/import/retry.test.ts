import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RETRY_DELAYS_MS, retryWithBackoff } from './retry';

describe('retryWithBackoff (FR-027; research §4)', () => {
  it('returns immediately on first success without sleeping', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(retryWithBackoff(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('succeeds after transient failures, waiting [1s, 2s] before retries', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient-1'))
      .mockRejectedValueOnce(new Error('transient-2'))
      .mockResolvedValue('recovered');

    await expect(retryWithBackoff(fn, { sleep })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([1_000, 2_000]);
  });

  it('exhausts the full [1s, 2s, 4s] schedule then throws the last error', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));

    await expect(retryWithBackoff(fn, { sleep })).rejects.toThrow('permanent');
    // 1 initial attempt + 3 retries (FR-027).
    expect(fn).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map((call) => call[0])).toEqual([...DEFAULT_RETRY_DELAYS_MS]);
  });

  it('honours a custom delay schedule', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue(new Error('nope'));

    await expect(retryWithBackoff(fn, { delaysMs: [0], sleep })).rejects.toThrow('nope');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });
});
