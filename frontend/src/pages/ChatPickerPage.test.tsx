import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '@chatframe/shared';
import { ChatPickerPage } from './ChatPickerPage';
import { ApiError } from '../api/client';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useSessionStore } from '../stores/useSessionStore';

const chats: ChatSummary[] = [
  {
    id: '966501234567@c.us',
    displayName: 'أحمد محمد',
    phoneNumber: '+966501234567',
    isGroup: false,
    lastMessagePreview: 'تمام، نلتقي بكرة',
    lastMessageAt: '2026-06-09T14:32:00.000Z',
  },
  {
    id: '14155550142@c.us',
    displayName: 'Sarah Johnson',
    phoneNumber: '+14155550142',
    isGroup: false,
    lastMessagePreview: 'See you tomorrow!',
    lastMessageAt: '2026-06-09T11:05:00.000Z',
  },
];

const useChatsMock = vi.fn();

vi.mock('../api/chats.api', async () => {
  const actual = await vi.importActual('../api/chats.api');
  return { ...actual, useChats: () => useChatsMock() as unknown };
});

/** Captures the router state forwarded to the import step (FR-013). */
function ImportProbe() {
  const location = useLocation();
  return <div data-testid="import-state">{JSON.stringify(location.state)}</div>;
}

function renderPicker() {
  return render(
    <MemoryRouter initialEntries={['/chat-picker']}>
      <Routes>
        <Route path="/chat-picker" element={<ChatPickerPage />} />
        <Route path="/import" element={<ImportProbe />} />
        <Route path="/connect" element={<div data-testid="connect-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function rowByName(name: string): HTMLElement {
  const row = screen
    .getAllByRole('button')
    .find((button) => button.textContent !== null && button.textContent.includes(name));
  if (row === undefined) {
    throw new Error(`no chat row containing "${name}"`);
  }
  return row;
}

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en');
  useSessionStore.getState().reset();
  useChatsMock.mockReturnValue({
    data: chats,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatPickerPage selection (US3, FR-012, FR-013)', () => {
  it('disables Continue while no chat is selected', () => {
    renderPicker();

    const cont = screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' });
    expect(cont.disabled).toBe(true);
  });

  it('highlights a clicked chat and enables Continue', () => {
    renderPicker();

    fireEvent.click(rowByName('Sarah Johnson'));

    expect(rowByName('Sarah Johnson').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' }).disabled).toBe(
      false,
    );
  });

  it('moves the highlight on a second selection (single-selection)', () => {
    renderPicker();

    fireEvent.click(rowByName('Sarah Johnson'));
    fireEvent.click(rowByName('أحمد محمد'));

    expect(rowByName('Sarah Johnson').getAttribute('aria-pressed')).toBe('false');
    expect(rowByName('أحمد محمد').getAttribute('aria-pressed')).toBe('true');
  });

  it('forwards the selected chat identity to the import step (SC-004)', () => {
    renderPicker();

    fireEvent.click(rowByName('Sarah Johnson'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const state = JSON.parse(screen.getByTestId('import-state').textContent ?? 'null') as {
      chat: { id: string; displayName: string | null; phoneNumber: string | null };
    };
    expect(state.chat).toEqual({
      id: '14155550142@c.us',
      displayName: 'Sarah Johnson',
      phoneNumber: '+14155550142',
    });
  });

  it('clears the prior selection on remount (return navigation, Edge Cases)', () => {
    const { unmount } = renderPicker();
    fireEvent.click(rowByName('Sarah Johnson'));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' }).disabled).toBe(
      false,
    );

    unmount();
    renderPicker();

    expect(rowByName('Sarah Johnson').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue' }).disabled).toBe(true);
  });
});

describe('ChatPickerPage error and disconnect states (US4, FR-015, FR-016)', () => {
  it('shows the loading indicator while the first fetch is in flight', () => {
    useChatsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPicker();

    expect(screen.getByText('Loading chats…')).toBeTruthy();
  });

  it('shows the not-connected view with a connection action on a 409 (FR-006)', () => {
    useChatsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiError('/api/chats/private', 409, 'SESSION_NOT_CONNECTED'),
      refetch: vi.fn(),
    });
    renderPicker();

    expect(
      screen.getByText('WhatsApp is not connected. Reconnect to view your chats.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Connection' }));
    expect(screen.getByTestId('connect-page')).toBeTruthy();
  });

  it('shows a retryable error for generic fetch failures (FR-015)', () => {
    const refetch = vi.fn();
    useChatsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network down'),
      refetch,
    });
    renderPicker();

    expect(screen.getByText('Could not load chats. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('replaces the list when the session drops while viewing (FR-016, SC-006)', () => {
    renderPicker();
    expect(screen.getByText('Sarah Johnson')).toBeTruthy();

    act(() => {
      useSessionStore.getState().applyStateEvent({ state: 'connected', error: null });
    });
    act(() => {
      useSessionStore.getState().applyStateEvent({
        state: 'disconnected',
        error: null,
      });
    });

    expect(screen.queryByText('Sarah Johnson')).toBeNull();
    expect(
      screen.getByText('WhatsApp is not connected. Reconnect to view your chats.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Connection' }));
    expect(screen.getByTestId('connect-page')).toBeTruthy();
  });

  it('does not hide the list for the store default disconnected state (mock dev)', () => {
    // The store idles at `disconnected` before any session event arrives; a
    // successful fetch must still render the list (research §9, quickstart D).
    renderPicker();

    expect(screen.getByText('Sarah Johnson')).toBeTruthy();
  });
});
