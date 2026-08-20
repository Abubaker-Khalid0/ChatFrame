import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CancelImportResponse,
  ImportProgress,
  StartImportRequest,
  StartImportResponse,
} from '@chatframe/shared';
import { ImportProgressStage } from './ImportProgressStage';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useImportStore } from '../../stores/useImportStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';

const startImportMock = vi.fn();
const getImportStatusMock = vi.fn();
const cancelImportMock = vi.fn();

vi.mock('../../api/import.api', async () => {
  const actual = await vi.importActual('../../api/import.api');
  return {
    ...actual,
    startImport: (request: unknown) => startImportMock(request) as Promise<StartImportResponse>,
    getImportStatus: (importId: string) => getImportStatusMock(importId) as Promise<ImportProgress>,
    cancelImport: (importId: string) => cancelImportMock(importId) as Promise<CancelImportResponse>,
  };
});

const eventsClient = { start: vi.fn(), stop: vi.fn() };
vi.mock('../../api/importEvents', async () => {
  const actual = await vi.importActual('../../api/importEvents');
  return { ...actual, createImportEventsClient: () => eventsClient };
});

const request: StartImportRequest = {
  chatId: '905551234567@c.us',
  chatDisplayName: 'Layla',
  options: { includeImages: true },
};

function progressOf(overrides: Partial<ImportProgress>): ImportProgress {
  return {
    importId: 'imp_1',
    projectId: 'chatframe_2026-06-12_Layla',
    stage: 'fetching_messages',
    messagesImported: 0,
    imagesDownloaded: 0,
    warnings: [],
    startedAt: '2026-06-12T05:19:02.000Z',
    ...overrides,
  };
}

function renderProgress() {
  useWorkflowStore.setState({
    importId: 'imp_1',
    projectId: 'chatframe_2026-06-12_Layla',
    importRequest: request,
    stage: 'import-progress',
  });
  return render(<ImportProgressStage />);
}

function applyProgress(overrides: Partial<ImportProgress>) {
  act(() => {
    useImportStore.getState().applyProgress(progressOf(overrides));
  });
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  useImportStore.getState().reset();
  useWorkflowStore.getState().reset();
  getImportStatusMock.mockRejectedValue(new Error('no snapshot'));
  cancelImportMock.mockResolvedValue({
    importId: 'imp_1',
    stage: 'fetching_messages',
    cancellationRequested: true,
  } satisfies CancelImportResponse);
  startImportMock.mockResolvedValue({
    importId: 'imp_2',
    projectId: 'chatframe_2026-06-12_Layla-2',
    stage: 'preparing_project',
    startedAt: '2026-06-12T05:30:00.000Z',
  } satisfies StartImportResponse);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImportProgressStage — live rendering (FR-019, FR-020, US3)', () => {
  it('subscribes to import events for the lifetime of the stage', () => {
    const { unmount } = renderProgress();
    expect(eventsClient.start).toHaveBeenCalledTimes(1);
    unmount();
    expect(eventsClient.stop).toHaveBeenCalledTimes(1);
  });

  it('renders the stage label and "Imported X" while the total is unknown', () => {
    renderProgress();
    applyProgress({ stage: 'fetching_messages', messagesImported: 37 });

    expect(screen.getByText('Fetching messages…')).toBeDefined();
    expect(screen.getByText('Imported 37 messages')).toBeDefined();
  });

  it('renders "Imported X / Y" and "Downloaded X / Y" when totals are known', () => {
    renderProgress();
    applyProgress({
      stage: 'downloading_images',
      messagesImported: 1284,
      messagesTotal: 1284,
      imagesDownloaded: 37,
      imagesTotal: 52,
    });

    expect(screen.getByText('Imported 1284 / 1284 messages')).toBeDefined();
    expect(screen.getByText('Downloaded 37 / 52 images')).toBeDefined();
  });

  it('updates the warnings list as warning events arrive (US3 AC-4)', () => {
    renderProgress();
    applyProgress({ stage: 'downloading_images', imagesTotal: 5 });

    act(() => {
      useImportStore.getState().applyWarning({
        importId: 'imp_1',
        code: 'IMAGE_DOWNLOAD_FAILED',
        message: 'Image unavailable after 3 retries; marked missing.',
      });
      useImportStore.getState().applyWarning({
        importId: 'imp_1',
        code: 'INVALID_RAW_LINE',
        message: 'Skipped one invalid raw line.',
      });
    });

    expect(screen.getByText('Warnings')).toBeDefined();
    expect(screen.getByText('Image unavailable after 3 retries; marked missing.')).toBeDefined();
    expect(screen.getByText('Skipped one invalid raw line.')).toBeDefined();
  });

  it('falls back to the status endpoint for late joiners (FR-014)', async () => {
    getImportStatusMock.mockResolvedValue(
      progressOf({ stage: 'normalizing', messagesImported: 12, messagesTotal: 12 }),
    );

    renderProgress();

    await waitFor(() => {
      expect(getImportStatusMock).toHaveBeenCalledWith('imp_1');
      expect(screen.getByText('Normalizing messages…')).toBeDefined();
    });
  });

  it('advances to the quality stage on completion (FR-022)', async () => {
    renderProgress();
    applyProgress({ stage: 'completed', messagesImported: 12, messagesTotal: 12 });

    await waitFor(() => {
      const state = useWorkflowStore.getState();
      expect(state.stage).toBe('quality');
      expect(state.projectId).toBe('chatframe_2026-06-12_Layla');
    });
  });
});

describe('ImportProgressStage — cancellation (FR-021, US4)', () => {
  it('disables Cancel during the non-cancellable preparing stage', () => {
    renderProgress();
    applyProgress({ stage: 'preparing_project' });

    const cancel = screen.getByRole('button', { name: 'Cancel import' });
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Cancel in a cancellable stage and shows "Cancelling…" after click', async () => {
    renderProgress();
    applyProgress({ stage: 'fetching_messages', messagesImported: 3 });

    const cancel = screen.getByRole('button', { name: 'Cancel import' });
    expect((cancel as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(cancel);

    await waitFor(() => {
      expect(cancelImportMock).toHaveBeenCalledWith('imp_1');
      expect(screen.getByRole('button', { name: 'Cancelling…' })).toBeDefined();
    });
  });

  it('shows the Cancelled view with Back and Retry (US4 AC-3/AC-4)', () => {
    renderProgress();
    applyProgress({ stage: 'cancelled', messagesImported: 5 });

    expect(screen.getByText('Import cancelled')).toBeDefined();
    expect(screen.getByText('Imported 5 messages')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to chat picker' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('Back returns to the chat picker; Retry starts a fresh import (FR-030)', async () => {
    renderProgress();
    applyProgress({ stage: 'cancelled' });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(startImportMock).toHaveBeenCalledWith(request);
    });
    expect(useImportStore.getState().progress).toBeNull();
    await waitFor(() => {
      const state = useWorkflowStore.getState();
      expect(state.stage).toBe('import-progress');
      expect(state.importId).toBe('imp_2');
    });
  });

  it('Back to chat picker clears the failed import', () => {
    renderProgress();
    applyProgress({ stage: 'cancelled' });

    fireEvent.click(screen.getByRole('button', { name: 'Back to chat picker' }));
    const state = useWorkflowStore.getState();
    expect(state.stage).toBe('chat-picker');
    expect(state.importId).toBeNull();
  });
});

describe('ImportProgressStage — fatal errors (US5 AC-3)', () => {
  it('shows a clear, sanitized failure message with Back and Retry', () => {
    renderProgress();
    applyProgress({ stage: 'failed', messagesImported: 7 });
    act(() => {
      useImportStore.getState().applyError({
        importId: 'imp_1',
        code: 'SESSION_DISCONNECTED',
        message: 'The WhatsApp session was lost during import. Reconnect and try again.',
      });
    });

    expect(screen.getByText('Import failed')).toBeDefined();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(
      'The WhatsApp session was lost during import. Reconnect and try again.',
    );
    expect(alert.textContent).not.toMatch(/Error:|\.ts|stack/i);

    expect(screen.getByRole('button', { name: 'Back to chat picker' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});
