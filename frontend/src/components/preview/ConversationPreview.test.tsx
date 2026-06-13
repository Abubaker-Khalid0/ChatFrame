import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageRow } from '@chatframe/shared';
import { ConversationPreview } from './ConversationPreview';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';

/** Total mock rows — large enough that full rendering would be obvious. */
const TOTAL_ROWS = 1000;
const PAGE_SIZE = 100;
const ROW_HEIGHT = 56;

let totalRows = TOTAL_ROWS;

const getJsonMock = vi.fn(async (path: string): Promise<unknown> => {
  if (path.includes('/preview/count')) {
    return { projectId: 'proj-1', totalMessages: totalRows };
  }
  const url = new URL(`http://local${path}`);
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const limit = Number(url.searchParams.get('limit') ?? String(PAGE_SIZE));
  return {
    projectId: 'proj-1',
    chatId: 'chat-001',
    participants: [
      { id: 'me', displayName: 'You', isMe: true },
      { id: 'contact-001', displayName: 'Ahmed', isMe: false },
    ],
    messages: makeRows(offset, Math.min(limit, Math.max(totalRows - offset, 0))),
    offset,
    limit,
    totalRows,
    appliedPrivacy: { showContactName: true, showPhoneNumber: false },
  };
});

vi.mock('../../api/client', () => ({
  getJson: (path: string) => getJsonMock(path),
  apiUrl: (path: string) => path,
}));

function makeRows(offset: number, count: number): MessageRow[] {
  return Array.from({ length: count }, (_, i) => {
    const index = offset + i;
    return {
      kind: 'message' as const,
      id: `m-${index}`,
      senderId: index % 2 === 0 ? 'me' : 'contact-001',
      senderDisplayName: index % 2 === 0 ? 'You' : 'Ahmed',
      direction: index % 2 === 0 ? ('sent' as const) : ('received' as const),
      type: 'text' as const,
      timestampIso: `2026-06-07T08:00:${String(index % 60).padStart(2, '0')}.000Z`,
      dateKey: '2026-06-07',
      body: `message ${index}`,
    };
  });
}

function renderPreview() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConversationPreview projectId="proj-1" />
    </QueryClientProvider>,
  );
}

/** The virtualizer's scrollable element. */
function scrollElement(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.cf-chat__scroll');
  if (!(el instanceof HTMLElement)) {
    throw new Error('scroll element not mounted');
  }
  return el;
}

/** Viewport height of the mocked scroll element. */
const VIEWPORT_HEIGHT = 600;

/** Layout properties the virtualizer reads; jsdom reports 0 for all of them. */
const LAYOUT_PROPS = ['offsetHeight', 'offsetWidth', 'clientHeight', 'scrollHeight'] as const;
const originalDescriptors = new Map(
  LAYOUT_PROPS.map((prop) => [prop, Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)]),
);

beforeEach(() => {
  totalRows = TOTAL_ROWS;
  getJsonMock.mockClear();
  useLanguageStore.getState().setLanguage('en');
  usePreviewSettingsStore.getState().setScrollOffset(0);

  // jsdom has no layout engine: the virtualizer reads offsetWidth/offsetHeight
  // (viewport rect + per-row measurement) and scrollHeight/clientHeight (max
  // scroll offset clamping), so fake all of them.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('cf-chat__scroll') ? VIEWPORT_HEIGHT : ROW_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 420;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('cf-chat__scroll') ? VIEWPORT_HEIGHT : ROW_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('cf-chat__scroll') ? totalRows * ROW_HEIGHT : ROW_HEIGHT;
    },
  });

  // jsdom lacks ResizeObserver and Element.scrollTo, both used by the
  // virtualizer; provide minimal stand-ins.
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

describe('ConversationPreview virtual scrolling (US2, FR-007)', () => {
  it('mounts only the visible rows plus buffer, not the whole conversation', async () => {
    const { container } = renderPreview();

    await waitFor(() => {
      expect(container.querySelectorAll('[data-index]').length).toBeGreaterThan(0);
    });

    const mounted = container.querySelectorAll('[data-index]').length;
    expect(mounted).toBeLessThan(100);
    // First page content is rendered.
    await waitFor(() => {
      expect(screen.getByText('message 0')).toBeTruthy();
    });
  });

  it('fetches the page for the scrolled-to window on demand (debounced)', async () => {
    const { container } = renderPreview();
    await waitFor(() => {
      expect(screen.getByText('message 0')).toBeTruthy();
    });

    const scroller = scrollElement(container);
    // Jump to ~row 500 (page offset 500).
    scroller.scrollTop = 500 * ROW_HEIGHT;
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(getJsonMock.mock.calls.some(([path]) => String(path).includes('offset=500'))).toBe(
        true,
      );
    });
  });

  it('debounces rapid scrolls — intermediate pages are never requested', async () => {
    const { container } = renderPreview();
    await waitFor(() => {
      expect(screen.getByText('message 0')).toBeTruthy();
    });

    const scroller = scrollElement(container);
    // Rapid successive positions; only the final one should trigger a fetch.
    for (const row of [200, 400, 600, 900]) {
      scroller.scrollTop = row * ROW_HEIGHT;
      fireEvent.scroll(scroller);
    }

    await waitFor(() => {
      expect(getJsonMock.mock.calls.some(([path]) => String(path).includes('offset=900'))).toBe(
        true,
      );
    });
    const fetched = getJsonMock.mock.calls.map(([path]) => String(path));
    expect(fetched.some((path) => path.includes('offset=200'))).toBe(false);
    expect(fetched.some((path) => path.includes('offset=400'))).toBe(false);
    expect(fetched.some((path) => path.includes('offset=600'))).toBe(false);
  });

  it('handles a 5,000+ message conversation with bounded mounting (010 US5)', async () => {
    totalRows = 5000;
    const { container } = renderPreview();

    await waitFor(() => {
      expect(screen.getByText('message 0')).toBeTruthy();
    });
    // Mounted rows stay bounded regardless of conversation size — the page
    // never renders thousands of DOM nodes (no UI freeze at scale).
    expect(container.querySelectorAll('[data-index]').length).toBeLessThan(100);

    // Jump straight to the end of the conversation; only the page for the
    // final window is requested.
    const scroller = scrollElement(container);
    scroller.scrollTop = 4990 * ROW_HEIGHT;
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(getJsonMock.mock.calls.some(([path]) => String(path).includes('offset=4900'))).toBe(
        true,
      );
    });
    expect(container.querySelectorAll('[data-index]').length).toBeLessThan(100);
  });

  it('shows the empty state when the conversation has no messages (FR-030)', async () => {
    totalRows = 0;
    renderPreview();

    await waitFor(() => {
      expect(screen.getByText('No messages to show.')).toBeTruthy();
    });
  });

  it('restores the saved scroll position on re-mount (FR-029)', async () => {
    usePreviewSettingsStore.getState().setScrollOffset(500);
    const { container } = renderPreview();

    await waitFor(() => {
      expect(scrollElement(container).scrollTop).toBe(500);
    });
  });

  it('persists the scroll offset to the settings store while scrolling', async () => {
    const { container } = renderPreview();
    await waitFor(() => {
      expect(screen.getByText('message 0')).toBeTruthy();
    });

    const scroller = scrollElement(container);
    scroller.scrollTop = 1234;
    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(usePreviewSettingsStore.getState().scrollOffset).toBe(1234);
    });
  });
});
