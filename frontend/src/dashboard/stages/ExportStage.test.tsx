import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportResult } from '@chatframe/shared';
import { ExportStage } from './ExportStage';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';

const postJsonMock = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual('../../api/client');
  return {
    ...actual,
    postJson: (path: string, body: unknown) => postJsonMock(path, body) as Promise<unknown>,
  };
});

const RESULT: ExportResult = {
  projectId: 'proj-1',
  exportDir: 'exports/html',
  htmlFilePath: 'exports/html/conversation.html',
  imageCount: 3,
  totalAssetSize: 1024,
  durationMs: 250,
};

function renderStage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  useWorkflowStore.setState({ projectId: 'proj-1', stage: 'export' });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExportStage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  useWorkflowStore.getState().reset();
  usePreviewSettingsStore.setState({
    theme: 'light',
    privacy: { showContactName: true, showPhoneNumber: false },
    showWatermark: true,
  });
  postJsonMock.mockResolvedValue(RESULT);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExportStage — Export Settings (US5)', () => {
  it('renders the documented defaults', () => {
    renderStage();

    expect(
      (screen.getByRole('checkbox', { name: 'Show contact name' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByRole('checkbox', { name: 'Show phone number' }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Include "Exported by ChatFrame" watermark',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect((screen.getByRole('radio', { name: 'Light' }) as HTMLInputElement).checked).toBe(true);
    expect(
      screen.getByText('Avatars are always generated — real profile pictures are never used.'),
    ).toBeDefined();
  });

  it('controls write to the shared preview store (FR-014)', () => {
    renderStage();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show phone number' }));
    expect(usePreviewSettingsStore.getState().privacy.showPhoneNumber).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('e.g. Friend'), {
      target: { value: 'Friend' },
    });
    expect(usePreviewSettingsStore.getState().privacy.displayAlias).toBe('Friend');

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Include "Exported by ChatFrame" watermark' }),
    );
    expect(usePreviewSettingsStore.getState().showWatermark).toBe(false);

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(usePreviewSettingsStore.getState().theme).toBe('dark');
  });

  it('seeds the theme from the preview store (US3 AC-3)', () => {
    usePreviewSettingsStore.setState({ theme: 'dark' });
    renderStage();

    expect((screen.getByRole('radio', { name: 'Dark' }) as HTMLInputElement).checked).toBe(true);
  });

  it('submit shows the blocking modal, then advances to the completion stage (FR-026)', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    postJsonMock.mockReturnValue(
      new Promise((resolvePromise) => {
        resolveRequest = resolvePromise;
      }),
    );
    usePreviewSettingsStore.setState({
      theme: 'dark',
      privacy: { showContactName: false, showPhoneNumber: false, displayAlias: 'Friend' },
      showWatermark: false,
    });
    renderStage();

    fireEvent.click(screen.getByRole('button', { name: 'Export HTML' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Exporting…')).toBeDefined();
    });

    expect(postJsonMock).toHaveBeenCalledWith('/api/projects/proj-1/export/html', {
      settings: {
        showContactName: false,
        showPhoneNumber: false,
        displayAlias: 'Friend',
        showWatermark: false,
        theme: 'dark',
      },
      locale: 'en',
    });

    resolveRequest(RESULT);

    await waitFor(() => {
      const state = useWorkflowStore.getState();
      expect(state.stage).toBe('export-complete');
      expect(state.exportResult?.htmlFilePath).toBe('exports/html/conversation.html');
    });
  });

  it('failure shows the error in the modal with Retry and Back to Preview (FR-017)', async () => {
    postJsonMock.mockRejectedValue(new Error('500'));
    renderStage();

    fireEvent.click(screen.getByRole('button', { name: 'Export HTML' }));

    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeDefined();
      expect(
        screen.getByText('The export could not be completed. Please try again.'),
      ).toBeDefined();
    });

    postJsonMock.mockResolvedValue(RESULT);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(postJsonMock).toHaveBeenCalledTimes(2);
    });
  });

  it('Back to Preview in the error modal returns to the preview stage', async () => {
    postJsonMock.mockRejectedValue(new Error('500'));
    renderStage();

    fireEvent.click(screen.getByRole('button', { name: 'Export HTML' }));
    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeDefined();
    });

    const backButtons = screen.getAllByRole('button', { name: 'Back to Preview' });
    fireEvent.click(backButtons[backButtons.length - 1] as HTMLElement);
    expect(useWorkflowStore.getState().stage).toBe('preview');
  });

  it('sends the active app locale with the request (SC-010)', async () => {
    useLanguageStore.getState().setLanguage('ar');
    renderStage();

    fireEvent.click(screen.getByRole('button', { name: 'تصدير HTML' }));

    await waitFor(() => {
      expect(postJsonMock).toHaveBeenCalledWith(
        '/api/projects/proj-1/export/html',
        expect.objectContaining({ locale: 'ar' }),
      );
    });
  });
});
