import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportResult, ShellOpenFolderResponse } from '@chatframe/shared';
import { ExportCompleteStage } from './ExportCompleteStage';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';

const openFolderMock = vi.fn();

vi.mock('../../api/export.api', async () => {
  const actual = await vi.importActual('../../api/export.api');
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

function renderComplete() {
  useWorkflowStore.setState({
    projectId: 'proj-1',
    exportResult: RESULT,
    stage: 'export-complete',
  });
  return render(<ExportCompleteStage />);
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  useWorkflowStore.getState().reset();
  openFolderMock.mockResolvedValue({ opened: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExportCompleteStage (US6, FR-015/016)', () => {
  it('shows the export folder and HTML file paths from the ExportResult', () => {
    renderComplete();

    expect(screen.getByText('Export complete')).toBeDefined();
    expect(screen.getByText('exports/html')).toBeDefined();
    expect(screen.getByText('exports/html/conversation.html')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('Open HTML opens the served export in a new tab', () => {
    renderComplete();

    const link = screen.getByRole('link', { name: 'Open HTML' }) as HTMLAnchorElement;
    expect(link.target).toBe('_blank');
    expect(link.href).toContain('/api/projects/proj-1/export/files/conversation.html');
  });

  it('Open Folder calls the shell endpoint with the export directory', async () => {
    renderComplete();

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    await waitFor(() => {
      expect(openFolderMock).toHaveBeenCalledWith('proj-1', 'exports/html');
    });
    expect(screen.getByRole('button', { name: 'Open Folder' })).toBeDefined();
  });

  it('hides Open Folder when the platform is unsupported (opened: false)', async () => {
    openFolderMock.mockResolvedValue({ opened: false });
    renderComplete();

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Open Folder' })).toBeNull();
    });
  });

  it('shows an error when the shell endpoint fails', async () => {
    openFolderMock.mockRejectedValue(new Error('500'));
    renderComplete();

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));
    await waitFor(() => {
      expect(screen.getByText('Could not open the folder.')).toBeDefined();
    });
  });

  it('Start New Import resets the workflow back to the chat picker', () => {
    renderComplete();

    fireEvent.click(screen.getByRole('button', { name: 'Start New Import' }));
    const state = useWorkflowStore.getState();
    expect(state.stage).toBe('chat-picker');
    expect(state.projectId).toBeNull();
    expect(state.exportResult).toBeNull();
  });

  it('guides back to export settings when no result is present', () => {
    useWorkflowStore.setState({
      projectId: 'proj-1',
      exportResult: null,
      stage: 'export-complete',
    });
    render(<ExportCompleteStage />);

    expect(screen.getByText('No export result was found. Run the export again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back to export settings' }));
    expect(useWorkflowStore.getState().stage).toBe('export');
  });
});
