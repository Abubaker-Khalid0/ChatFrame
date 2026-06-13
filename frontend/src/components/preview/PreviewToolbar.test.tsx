import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationPreview } from './ConversationPreview';
import { PreviewToolbar } from './PreviewToolbar';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';

/** A small two-sender conversation; the contact id carries a phone-like user part. */
const CONTACT_ID = '966501234567@c.us';

const getJsonMock = vi.fn(async (path: string): Promise<unknown> => {
  if (path.includes('/preview/count')) {
    return { projectId: 'proj-1', totalMessages: 2 };
  }
  return {
    projectId: 'proj-1',
    chatId: 'chat-001',
    participants: [
      { id: 'me', displayName: 'You', isMe: true },
      { id: CONTACT_ID, displayName: 'أحمد محمد', isMe: false },
    ],
    messages: [
      {
        kind: 'message',
        id: 'm-0',
        senderId: CONTACT_ID,
        senderDisplayName: 'أحمد محمد',
        direction: 'received',
        type: 'text',
        timestampIso: '2026-06-07T08:00:00.000Z',
        dateKey: '2026-06-07',
        body: 'hello there',
      },
      {
        kind: 'message',
        id: 'm-1',
        senderId: 'me',
        senderDisplayName: 'You',
        direction: 'sent',
        type: 'text',
        timestampIso: '2026-06-07T08:00:01.000Z',
        dateKey: '2026-06-07',
        body: 'hi!',
      },
    ],
    offset: 0,
    limit: 100,
    totalRows: 2,
    appliedPrivacy: { showContactName: true, showPhoneNumber: false },
  };
});

vi.mock('../../api/client', () => ({
  getJson: (path: string) => getJsonMock(path),
  apiUrl: (path: string) => path,
}));

/** Layout properties the virtualizer reads; jsdom reports 0 for all of them. */
const LAYOUT_PROPS = ['offsetHeight', 'offsetWidth', 'clientHeight', 'scrollHeight'] as const;
const originalDescriptors = new Map(
  LAYOUT_PROPS.map((prop) => [prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)]),
);

function renderPreviewScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PreviewToolbar projectId="proj-1" />
        <ConversationPreview projectId="proj-1" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** The themed chat root element. */
function chatRoot(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.cf-chat');
  if (!(el instanceof HTMLElement)) {
    throw new Error('chat root not mounted');
  }
  return el;
}

beforeEach(() => {
  getJsonMock.mockClear();
  useLanguageStore.getState().setLanguage('en');
  const store = usePreviewSettingsStore.getState();
  store.setTheme('light');
  store.setFontScale(1);
  store.setWidthPx(420);
  store.setPrivacy({ showContactName: true, showPhoneNumber: false });
  store.setScrollOffset(0);

  for (const prop of LAYOUT_PROPS) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('cf-chat__scroll') && prop !== 'offsetWidth' ? 600 : 56;
      },
    });
  }
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollTo = function scrollTo(options?: ScrollToOptions | number) {
    const top = typeof options === 'number' ? options : (options?.top ?? 0);
    (this as HTMLElement).scrollTop = top;
    this.dispatchEvent(new Event('scroll'));
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const prop of LAYOUT_PROPS) {
    const original = originalDescriptors.get(prop);
    if (original) {
      Object.defineProperty(HTMLElement.prototype, prop, original);
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
    }
  }
});

describe('PreviewToolbar — theme toggle (US3, FR-017)', () => {
  it('toggles the store and the data-theme attribute without a re-fetch', async () => {
    const { container } = renderPreviewScreen();
    await waitFor(() => {
      expect(screen.getByText('hello there')).toBeTruthy();
    });

    expect(chatRoot(container).getAttribute('data-theme')).toBe('light');
    const requestsBefore = getJsonMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /Theme/ }));

    expect(usePreviewSettingsStore.getState().theme).toBe('dark');
    expect(chatRoot(container).getAttribute('data-theme')).toBe('dark');
    // No page reload and no data re-fetch (SC-003).
    expect(getJsonMock.mock.calls.length).toBe(requestsBefore);

    fireEvent.click(screen.getByRole('button', { name: /Theme/ }));
    expect(chatRoot(container).getAttribute('data-theme')).toBe('light');
  });
});

describe('PreviewToolbar — font size and width (US5, FR-018/FR-019)', () => {
  it('binds the font-scale slider to the --cf-font-scale variable', async () => {
    const { container } = renderPreviewScreen();
    await waitFor(() => {
      expect(screen.getByText('hello there')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '1.4' } });

    expect(usePreviewSettingsStore.getState().fontScale).toBeCloseTo(1.4);
    expect(chatRoot(container).style.getPropertyValue('--cf-font-scale')).toBe('1.4');
  });

  it('binds the width slider to the --cf-conversation-width variable', async () => {
    const { container } = renderPreviewScreen();
    await waitFor(() => {
      expect(screen.getByText('hello there')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Conversation width'), { target: { value: '640' } });

    expect(usePreviewSettingsStore.getState().widthPx).toBe(640);
    expect(chatRoot(container).style.getPropertyValue('--cf-conversation-width')).toBe('640px');
  });

  it('clamps font scale and width to their allowed bounds', () => {
    const store = usePreviewSettingsStore.getState();

    store.setFontScale(5);
    expect(usePreviewSettingsStore.getState().fontScale).toBe(1.6);
    store.setFontScale(0.1);
    expect(usePreviewSettingsStore.getState().fontScale).toBe(0.8);

    store.setWidthPx(10_000);
    expect(usePreviewSettingsStore.getState().widthPx).toBe(720);
    store.setWidthPx(100);
    expect(usePreviewSettingsStore.getState().widthPx).toBe(320);
  });
});

describe('PreviewToolbar — real-time privacy (US6, FR-020/FR-021)', () => {
  it('hides the contact name everywhere immediately, without a re-fetch', async () => {
    renderPreviewScreen();
    await waitFor(() => {
      expect(screen.getByText('hello there')).toBeTruthy();
    });
    // Header + sender label both show the real name initially.
    expect(screen.getAllByText('أحمد محمد').length).toBeGreaterThan(0);
    const requestsBefore = getJsonMock.mock.calls.length;

    fireEvent.click(screen.getByLabelText('Show contact name'));

    expect(screen.queryByText('أحمد محمد')).toBeNull();
    expect(screen.getAllByText('Contact').length).toBeGreaterThan(0);
    expect(getJsonMock.mock.calls.length).toBe(requestsBefore);
  });

  it('replaces the contact name with the alias everywhere', async () => {
    renderPreviewScreen();
    await waitFor(() => {
      expect(screen.getByText('hello there')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Display alias'), { target: { value: 'Friend' } });

    expect(screen.queryByText('أحمد محمد')).toBeNull();
    expect(screen.getAllByText('Friend').length).toBeGreaterThan(0);
  });

  it('shows and hides the phone number in the conversation header', async () => {
    renderPreviewScreen();
    await waitFor(() => {
      expect(screen.getByText('hello there')).toBeTruthy();
    });
    expect(screen.queryByText('+966501234567')).toBeNull();

    fireEvent.click(screen.getByLabelText('Show phone number'));
    expect(screen.getByText('+966501234567')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Show phone number'));
    expect(screen.queryByText('+966501234567')).toBeNull();
  });

  it('always renders a generated avatar, never a fetched image (FR-020)', async () => {
    const { container } = renderPreviewScreen();
    await waitFor(() => {
      expect(screen.getByText('hello there')).toBeTruthy();
    });

    const header = container.querySelector('.cf-chat__header');
    expect(header).not.toBeNull();
    // The generated avatar is a styled span with role="img" — no <img> tag.
    expect(header!.querySelector('span[role="img"]')).not.toBeNull();
    expect(header!.querySelector('img')).toBeNull();
  });
});
