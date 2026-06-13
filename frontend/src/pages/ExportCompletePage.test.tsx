import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportResult, ShellOpenFolderResponse } from '@chatframe/shared';
import { ExportCompletePage } from './ExportCompletePage';
import { useLanguageStore } from '../stores/useLanguageStore';

const openFolderMock = vi.fn();

vi.mock('../api/export.api', async () => {
  const actual = await vi.importActual('../api/export.api');
  return {
    ...actual,
    openFolder: (projectId: string, path: string) =>
      openFolderMock(projectId, path) as Promise<ShellOpenFolderResponse>,
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

function renderPage(state: unknown = { projectId: 'proj-1', result: RESULT }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/export/complete', state }]}>
      <Routes>
        <Route path="/export/complete" element={<ExportCompletePage />} />
        <Route path="/export" element={<div data-testid="export-settings" />} />
        <Route path="/next" element={<div data-testid="wizard-start" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  openFolderMock.mockResolvedValue({ opened: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExportCompletePage (US6, FR-015/016)', () => {
  it('shows the export folder and HTML file paths from the ExportResult', () => {
    renderPage();

    expect(screen.getByText('Export complete')).toBeDefined();
    expect(screen.getByText('exports/html')).toBeDefined();
    expect(screen.getByText('exports/html/conversation.html')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('Open HTML opens the served export in a new tab', () => {
    renderPage();

    const link = screen.getByRole('link', { name: 'Open HTML' }) as HTMLAnchorElement;
    expect(link.target).toBe('_blank');
    expect(link.href).toContain('/api/projects/proj-1/export/files/conversation.html');
  });

  it('Open Folder calls the shell endpoint with the export directory', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    await waitFor(() => {
      expect(openFolderMock).toHaveBeenCalledWith('proj-1', 'exports/html');
    });
    // Still visible — the platform supports it.
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeDefined();
  });

  it('hides Open Folder when the platform is unsupported (opened: false)', async () => {
    openFolderMock.mockResolvedValue({ opened: false });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Open Folder' })).toBeNull();
    });
  });

  it('shows an error when the shell endpoint fails', async () => {
    openFolderMock.mockRejectedValue(new Error('500'));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    await waitFor(() => {
      expect(screen.getByText('Could not open the folder.')).toBeDefined();
    });
  });

  it('Start New Import navigates to the beginning of the wizard', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start New Import' }));
    expect(screen.getByTestId('wizard-start')).toBeDefined();
  });

  it('guides back to export settings when no result was forwarded', () => {
    renderPage(null);

    expect(screen.getByText('No export result was found. Run the export again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to export settings' }));
    expect(screen.getByTestId('export-settings')).toBeDefined();
  });
});
