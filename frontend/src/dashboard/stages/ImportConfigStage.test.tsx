import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StartImportResponse } from '@chatframe/shared';
import { ImportConfigStage } from './ImportConfigStage';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useImportStore } from '../../stores/useImportStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';

const startImportMock = vi.fn();

vi.mock('../../api/import.api', async () => {
  const actual = await vi.importActual('../../api/import.api');
  return {
    ...actual,
    startImport: (request: unknown) => startImportMock(request) as Promise<StartImportResponse>,
  };
});

const chat = {
  id: '905551234567@c.us',
  displayName: 'Layla',
  phoneNumber: '+90 555 123 45 67',
};

function seedChat() {
  useWorkflowStore.setState({ selectedChat: chat, stage: 'import-config' });
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  useImportStore.getState().reset();
  useWorkflowStore.getState().reset();
  startImportMock.mockResolvedValue({
    importId: 'imp_1',
    projectId: 'chatframe_2026-06-12_Layla',
    stage: 'preparing_project',
    startedAt: '2026-06-12T05:19:02.000Z',
  } satisfies StartImportResponse);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ImportConfigStage — Import Options (FR-018)', () => {
  it('shows text import as always-on and disabled', () => {
    seedChat();
    render(<ImportConfigStage />);

    const textToggle = screen.getByRole('checkbox', { name: 'Import text messages' });
    expect((textToggle as HTMLInputElement).checked).toBe(true);
    expect((textToggle as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Always included')).toBeDefined();
  });

  it('defaults the images toggle to off and shows the longer-import note', () => {
    seedChat();
    render(<ImportConfigStage />);

    const imagesToggle = screen.getByRole('checkbox', { name: 'Import images' });
    expect((imagesToggle as HTMLInputElement).checked).toBe(false);
    expect((imagesToggle as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText('Importing images takes longer.')).toBeDefined();
  });

  it('starts a text-only import and advances to the progress stage', async () => {
    seedChat();
    render(<ImportConfigStage />);

    fireEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => {
      expect(startImportMock).toHaveBeenCalledWith({
        chatId: chat.id,
        chatDisplayName: chat.displayName,
        chatPhoneNumber: chat.phoneNumber,
        options: { includeImages: false },
      });
    });
    await waitFor(() => {
      const state = useWorkflowStore.getState();
      expect(state.stage).toBe('import-progress');
      expect(state.importId).toBe('imp_1');
    });
  });

  it('includes images when the toggle is enabled', async () => {
    seedChat();
    render(<ImportConfigStage />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Import images' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => {
      expect(startImportMock).toHaveBeenCalledWith(
        expect.objectContaining({ options: { includeImages: true } }),
      );
    });
  });

  it('shows an error and stays put when the start request fails', async () => {
    startImportMock.mockRejectedValue(new Error('409'));
    seedChat();
    render(<ImportConfigStage />);

    fireEvent.click(screen.getByRole('button', { name: 'Start import' }));

    await waitFor(() => {
      expect(screen.getByText('Could not start the import. Please try again.')).toBeDefined();
    });
    expect(useWorkflowStore.getState().stage).toBe('import-config');
  });

  it('guides back to the chat picker when no chat was selected', () => {
    useWorkflowStore.setState({ selectedChat: null, stage: 'import-config' });
    render(<ImportConfigStage />);

    expect(
      screen.getByText('No chat selected. Go back and choose a conversation first.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(useWorkflowStore.getState().stage).toBe('chat-picker');
  });
});
