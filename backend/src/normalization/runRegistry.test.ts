import { afterEach, describe, expect, it } from 'vitest';
import {
  NormalizationInProgressError,
  getStatus,
  isRunning,
  resetRegistry,
  startRun,
  whenSettled,
} from './runRegistry';

afterEach(() => {
  resetRegistry();
});

/** A promise plus its resolver, to control when a fake run settles. */
function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runRegistry (FR-020)', () => {
  it('reports idle for an unknown project', () => {
    expect(getStatus('p-unknown').state).toBe('idle');
    expect(isRunning('p-unknown')).toBe(false);
  });

  it('marks a project running until the run settles, then completed', async () => {
    const d = deferred();
    const started = startRun('p1', () => d.promise);

    expect(started.state).toBe('running');
    expect(isRunning('p1')).toBe(true);

    d.resolve();
    await whenSettled('p1');

    const status = getStatus('p1');
    expect(status.state).toBe('completed');
    expect(status.completedAt).not.toBeNull();
    expect(status.currentStep).toBeNull();
    expect(status.error).toBeNull();
  });

  it('rejects a second concurrent run with NormalizationInProgressError', async () => {
    const d = deferred();
    startRun('p2', () => d.promise);

    expect(() => startRun('p2', () => Promise.resolve())).toThrow(NormalizationInProgressError);

    d.resolve();
    await whenSettled('p2');

    // After settling, a new run may start.
    expect(() => startRun('p2', () => Promise.resolve())).not.toThrow();
    await whenSettled('p2');
  });

  it('records a failed run with a user-safe error message', async () => {
    startRun('p3', () => Promise.reject(new Error('disk full')));
    await whenSettled('p3');

    const status = getStatus('p3');
    expect(status.state).toBe('failed');
    expect(status.error).toBe('disk full');
  });

  it('surfaces the current step via the reporter', async () => {
    const d = deferred();
    startRun('p4', async (report) => {
      report('readRaw');
      await d.promise;
    });

    expect(getStatus('p4').currentStep).toBe('readRaw');
    d.resolve();
    await whenSettled('p4');
  });
});
