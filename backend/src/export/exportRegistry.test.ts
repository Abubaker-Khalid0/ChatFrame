import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireExportLock,
  ExportInProgressError,
  isExporting,
  releaseExportLock,
  resetExportRegistry,
} from './exportRegistry';

afterEach(() => {
  resetExportRegistry();
});

describe('exportRegistry (research §8, FR-021)', () => {
  it('acquires when free and reports the project as exporting', () => {
    expect(isExporting('p1')).toBe(false);
    acquireExportLock('p1');
    expect(isExporting('p1')).toBe(true);
  });

  it('throws ExportInProgressError when the lock is already held', () => {
    acquireExportLock('p1');
    expect(() => acquireExportLock('p1')).toThrow(ExportInProgressError);
    expect(() => acquireExportLock('p1')).toThrow(
      'An export is already in progress for this project',
    );
  });

  it('locks projects independently', () => {
    acquireExportLock('p1');
    expect(() => acquireExportLock('p2')).not.toThrow();
  });

  it('release frees the lock for re-acquisition', () => {
    acquireExportLock('p1');
    releaseExportLock('p1');
    expect(isExporting('p1')).toBe(false);
    expect(() => acquireExportLock('p1')).not.toThrow();
  });

  it('release is idempotent and safe when never acquired', () => {
    expect(() => releaseExportLock('never-held')).not.toThrow();
  });

  it('carries the EXPORT_IN_PROGRESS code for the route mapping', () => {
    acquireExportLock('p1');
    try {
      acquireExportLock('p1');
      expect.unreachable('second acquire must throw');
    } catch (error) {
      expect((error as ExportInProgressError).code).toBe('EXPORT_IN_PROGRESS');
    }
  });
});
