import { beforeEach, describe, expect, it } from 'vitest';
import type { ImportProgress } from '@chatframe/shared';
import {
  ImportInProgressError,
  clear,
  getProgress,
  isCancelRequested,
  requestCancel,
  resetImportRegistry,
  start,
  update,
} from './importRegistry';

function progressFor(importId: string, stage: ImportProgress['stage']): ImportProgress {
  return {
    importId,
    projectId: 'chatframe_2026-06-12_Layla',
    stage,
    messagesImported: 0,
    imagesDownloaded: 0,
    warnings: [],
    startedAt: '2026-06-12T05:19:02.000Z',
  };
}

beforeEach(() => {
  resetImportRegistry();
});

describe('importRegistry (FR-017; data-model §8)', () => {
  it('rejects a concurrent start with ImportInProgressError (409 path)', () => {
    start('imp_1');
    expect(() => start('imp_2')).toThrow(ImportInProgressError);
  });

  it('allows a new start after the slot is cleared', () => {
    start('imp_1');
    clear();
    expect(() => start('imp_2')).not.toThrow();
  });

  it('tracks the live progress snapshot per import id', () => {
    start('imp_1');
    update(progressFor('imp_1', 'fetching_messages'));

    expect(getProgress('imp_1')?.stage).toBe('fetching_messages');
    expect(getProgress('imp_unknown')).toBeNull();

    update({ ...progressFor('imp_1', 'normalizing'), messagesImported: 42 });
    expect(getProgress('imp_1')?.messagesImported).toBe(42);
  });

  it('retains the terminal snapshot after clear for late status reads', () => {
    start('imp_1');
    update(progressFor('imp_1', 'completed'));
    clear();
    expect(getProgress('imp_1')?.stage).toBe('completed');
  });

  it('registers cancellation only for the active import in a cancellable stage', () => {
    start('imp_1');
    update(progressFor('imp_1', 'fetching_messages'));

    expect(requestCancel('imp_other')).toBe(false);
    expect(isCancelRequested()).toBe(false);

    expect(requestCancel('imp_1')).toBe(true);
    expect(isCancelRequested()).toBe(true);
  });

  it('ignores cancellation in non-cancellable and terminal stages (US4 AC-5)', () => {
    start('imp_1');
    update(progressFor('imp_1', 'preparing_project'));
    expect(requestCancel('imp_1')).toBe(false);

    update(progressFor('imp_1', 'completed'));
    expect(requestCancel('imp_1')).toBe(false);
    expect(isCancelRequested()).toBe(false);
  });

  it('clears the cancellation signal with the slot', () => {
    start('imp_1');
    update(progressFor('imp_1', 'downloading_images'));
    expect(requestCancel('imp_1')).toBe(true);

    clear();
    expect(isCancelRequested()).toBe(false);

    start('imp_2');
    expect(isCancelRequested()).toBe(false);
  });
});
