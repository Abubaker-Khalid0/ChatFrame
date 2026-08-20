import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  PRIVACY_NAME_PLACEHOLDER,
  applyPrivacyToMessageRow,
  displayNameFor,
  phoneFromWhatsAppId,
  phoneNumberFor,
  type MessageRow,
  type PaginatedPreviewResponse,
  type Participant,
} from '@chatframe/shared';
import { useTranslations } from '../../i18n';
import { PREVIEW_PAGE_SIZE, previewPageQueryOptions, usePreviewCount } from '../../api/preview.api';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';
import { ChatAvatar } from '../chats/ChatAvatar';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { UnsupportedMessage } from './UnsupportedMessage';

/** Debounce window for scroll-driven page requests (US2 AC-3, research §6). */
const SCROLL_DEBOUNCE_MS = 130;

/** Rows rendered beyond the visible window on each side (FR-007). */
const DEFAULT_OVERSCAN = 5;

/** Estimated row height before measurement (a one-line text bubble). */
const ESTIMATED_ROW_HEIGHT = 56;

/**
 * Virtualized conversation panel (008 FR-007/009/017/020/021/023/026/029/030).
 *
 * The total row count (count endpoint) sizes the scroll area up front; only
 * the visible rows plus an overscan buffer are mounted. The visible range maps
 * to offset/limit pages fetched on demand (debounced); already-fetched pages
 * are read straight from the TanStack Query cache, so back-scrolling and
 * re-entering the screen never re-fetch. Theme, font scale, and width come
 * from the settings store as `data-theme` + CSS custom properties; privacy is
 * the shared presentational transform applied client-side over cached rows —
 * instant, with no re-fetch. The component renders normalized data verbatim —
 * no parsing, dedup, or resolution logic (Constitution VII).
 */
export function ConversationPreview({
  projectId,
  overscan = DEFAULT_OVERSCAN,
}: {
  projectId: string;
  overscan?: number;
}) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const countQuery = usePreviewCount(projectId);
  const totalRows = countQuery.data?.totalMessages ?? 0;
  const privacy = usePreviewSettingsStore((s) => s.privacy);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setScrollOffset = usePreviewSettingsStore((s) => s.setScrollOffset);
  // Capture the offset saved by the previous visit at first render: attaching
  // the scroll element can emit a scroll-to-0 event that would overwrite the
  // store before the restore effect runs (FR-029).
  const savedScrollOffsetRef = useRef(usePreviewSettingsStore.getState().scrollOffset);

  const virtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan,
    initialRect: { width: 420, height: 600 },
  });
  const items = virtualizer.getVirtualItems();

  // Map the (debounced) visible range to the page offsets it spans.
  const firstIndex = items[0]?.index ?? 0;
  const lastIndex = items[items.length - 1]?.index ?? 0;
  const [activeOffsets, setActiveOffsets] = useState<number[]>([0]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const firstPage = Math.floor(firstIndex / PREVIEW_PAGE_SIZE);
      const lastPage = Math.floor(lastIndex / PREVIEW_PAGE_SIZE);
      const offsets: number[] = [];
      for (let page = firstPage; page <= lastPage; page += 1) {
        offsets.push(page * PREVIEW_PAGE_SIZE);
      }
      setActiveOffsets((previous) =>
        previous.length === offsets.length && previous.every((v, i) => v === offsets[i])
          ? previous
          : offsets,
      );
    }, SCROLL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [firstIndex, lastIndex]);

  // Fetch the pages the visible window needs; resolved pages stay cached.
  useQueries({
    queries: activeOffsets.map((offset) => previewPageQueryOptions(projectId, offset)),
  });

  // Restore the saved scroll position once the scroll area has its height
  // (FR-029, research §6).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || totalRows === 0) {
      return;
    }
    restoredRef.current = true;
    const saved = savedScrollOffsetRef.current;
    if (saved > 0) {
      virtualizer.scrollToOffset(saved);
    }
  }, [totalRows, virtualizer]);

  /** Reads a row from the cached page that contains `index`, if loaded. */
  function rowAt(index: number): MessageRow | undefined {
    const offset = Math.floor(index / PREVIEW_PAGE_SIZE) * PREVIEW_PAGE_SIZE;
    const page = queryClient.getQueryData<PaginatedPreviewResponse>(
      previewPageQueryOptions(projectId, offset).queryKey,
    );
    return page?.messages[index - offset];
  }

  // Participants for the header come with every page; the first page is
  // always requested on mount.
  const firstPage = queryClient.getQueryData<PaginatedPreviewResponse>(
    previewPageQueryOptions(projectId, 0).queryKey,
  );
  const contact = firstPage?.participants.find((p) => !p.isMe);

  if (countQuery.isLoading) {
    return (
      <ChatShell>
        <div className="cf-empty" role="status" aria-live="polite">
          <div className="cf-spinner" aria-hidden="true" />
          <p>{t.preview.loading}</p>
        </div>
      </ChatShell>
    );
  }

  if (countQuery.isError) {
    return (
      <ChatShell>
        <div className="cf-empty" role="alert">
          <p>{t.preview.error}</p>
        </div>
      </ChatShell>
    );
  }

  if (totalRows === 0) {
    return (
      <ChatShell>
        <div className="cf-empty">
          <p>{t.preview.empty}</p>
        </div>
      </ChatShell>
    );
  }

  return (
    <ChatShell>
      {contact !== undefined && <ConversationHeader contact={contact} />}
      <div
        className="cf-chat__scroll"
        ref={scrollRef}
        onScroll={(event) => setScrollOffset(event.currentTarget.scrollTop)}
      >
        <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
          {items.map((item) => {
            const row = rowAt(item.index);
            const previous = item.index > 0 ? rowAt(item.index - 1) : undefined;
            // First row of the conversation, or a day change, gets a separator;
            // an unknown previous row (page not yet loaded) shows none to avoid
            // a flash of duplicates.
            const showSeparator =
              row !== undefined &&
              row.dateKey !== undefined &&
              (item.index === 0 || (previous !== undefined && previous.dateKey !== row.dateKey));
            const showSender =
              row !== undefined &&
              (previous === undefined ||
                previous.senderId !== row.senderId ||
                previous.dateKey !== row.dateKey);

            // Real-time privacy: the shared transform over the cached row —
            // instant on toggle, no re-fetch (FR-021, research §3).
            const displayRow = row !== undefined ? applyPrivacyToMessageRow(row, privacy) : row;

            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {displayRow === undefined ? (
                  // Page not loaded yet — shown only when scroll outpaces
                  // fetch; loaded rows stay scrollable (US2 edge case).
                  <div className="cf-loading" role="status" aria-label={t.preview.loading}>
                    <div className="cf-spinner" aria-hidden="true" />
                  </div>
                ) : (
                  <>
                    {showSeparator && displayRow.dateKey !== undefined && (
                      <DateSeparator dateKey={displayRow.dateKey} />
                    )}
                    {displayRow.type === 'unsupported' ? (
                      <UnsupportedMessage message={displayRow} />
                    ) : (
                      <MessageBubble
                        message={displayRow}
                        showSender={showSender}
                        projectId={projectId}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ChatShell>
  );
}

/**
 * The themed chat root: `data-theme` switches light/dark custom properties
 * (FR-017) and the font-scale/width custom properties bind the toolbar's
 * controls (FR-018/FR-019) — all without reload or re-fetch.
 */
function ChatShell({ children }: { children: ReactNode }) {
  const theme = usePreviewSettingsStore((s) => s.theme);
  const fontScale = usePreviewSettingsStore((s) => s.fontScale);
  const widthPx = usePreviewSettingsStore((s) => s.widthPx);

  return (
    <div
      className="cf-chat"
      data-theme={theme}
      style={
        {
          '--cf-font-scale': fontScale,
          '--cf-conversation-width': `${widthPx}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * Conversation header: generated avatar (never a real picture, FR-020) plus
 * the privacy-aware contact name and phone (header is the only place the
 * phone appears, FR-004/US6 AC-3).
 */
function ConversationHeader({ contact }: { contact: Participant }) {
  const t = useTranslations();
  const privacy = usePreviewSettingsStore((s) => s.privacy);

  const resolvedName = displayNameFor(contact.displayName, contact.isMe, privacy);
  const name = resolvedName === PRIVACY_NAME_PLACEHOLDER ? t.preview.contact : resolvedName;
  // Prefer the real number resolved during normalization; fall back to one
  // derived from a phone-based id for older data. A `@lid` privacy id never
  // yields a number, so it is never shown (or mistaken for one).
  const phone = phoneNumberFor(contact.phoneNumber ?? phoneFromWhatsAppId(contact.id), privacy);

  return (
    <div className="cf-chat__header">
      <ChatAvatar displayName={name} phoneNumber={phone ?? null} />
      <div>
        <div className="cf-chat__header-name" dir="auto">
          {name}
        </div>
        {phone !== undefined && <div className="cf-chat__header-phone">{phone}</div>}
      </div>
    </div>
  );
}
