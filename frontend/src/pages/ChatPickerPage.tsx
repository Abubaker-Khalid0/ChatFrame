import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ConnectionState } from '@chatframe/shared';
import { isNotConnectedError, useChats } from '../api/chats.api';
import { ChatList } from '../components/chats/ChatList';
import { ChatSearch } from '../components/chats/ChatSearch';
import { chatFilter } from '../components/chats/chatFilter';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { useSessionStore } from '../stores/useSessionStore';
import { useTranslations } from '../i18n';

/** Session states that mean the live connection is gone (FR-016). */
const FAILED_SESSION_STATES: ReadonlySet<ConnectionState> = new Set([
  'disconnected',
  'session_expired',
  'connection_failed',
]);

/** Discriminated rendering selector (data-model §4.3). */
type ChatListView = 'loading' | 'not-connected' | 'fetch-error' | 'list';

/**
 * Wizard step 1: choose a one-to-one chat. Loads the chat list, filters it in
 * real time by name or phone (FR-010), tracks a single selection (FR-012), and
 * advances to the import step carrying the chat identity (FR-013). Loading,
 * fetch-error (Retry), not-connected (reconnect), and live-disconnect states
 * are surfaced as clear, localized views (FR-015, FR-016).
 */
export function ChatPickerPage() {
  const t = useTranslations();
  const navigate = useNavigate();
  const { data: chats, isLoading, isError, error, refetch } = useChats();
  const [searchTerm, setSearchTerm] = useState('');
  // Local state, so a remount (return navigation) clears the prior selection.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Live-disconnect detection (FR-016): the store idles at `disconnected`
  // before any session event arrives, so only a transition observed *after*
  // session activity counts as a drop — mount-time disconnection is already
  // covered by the 409 from the fetch (research §9).
  const sessionState = useSessionStore((s) => s.state);
  const sawActiveSession = useRef(false);
  useEffect(() => {
    if (!FAILED_SESSION_STATES.has(sessionState)) {
      sawActiveSession.current = true;
    }
  }, [sessionState]);
  const sessionLost = FAILED_SESSION_STATES.has(sessionState) && sawActiveSession.current;

  const visibleChats = chatFilter(chats ?? [], searchTerm);
  const searchActive = searchTerm.trim().length > 0;
  const selectedChat = (chats ?? []).find((chat) => chat.id === selectedId);

  const view: ChatListView =
    sessionLost || (isError && isNotConnectedError(error))
      ? 'not-connected'
      : isLoading
        ? 'loading'
        : isError
          ? 'fetch-error'
          : 'list';

  const handleContinue = () => {
    if (selectedChat === undefined) {
      return;
    }
    navigate('/import', {
      state: {
        chat: {
          id: selectedChat.id,
          displayName: selectedChat.displayName,
          phoneNumber: selectedChat.phoneNumber,
        },
      },
    });
  };

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">{t.chatPicker.title}</h1>
      <p className="mt-2 text-gray-600">{t.chatPicker.subtitle}</p>

      <div className="mt-6">
        {view === 'loading' && <LoadingState message={t.chatPicker.loading} />}

        {view === 'not-connected' && (
          <EmptyState
            title={t.chatPicker.notConnected}
            actionLabel={t.chatPicker.goToConnection}
            onAction={() => navigate('/connect')}
          />
        )}

        {view === 'fetch-error' && (
          <ErrorState
            title={t.chatPicker.fetchError}
            retryLabel={t.chatPicker.retry}
            onRetry={() => void refetch()}
          />
        )}

        {view === 'list' && (
          <div className="flex flex-col gap-4">
            <ChatSearch value={searchTerm} onChange={setSearchTerm} />
            <ChatList
              chats={visibleChats}
              searchActive={searchActive}
              selectedId={selectedId}
              onSelect={(chat) => setSelectedId(chat.id)}
            />
            <button
              type="button"
              onClick={handleContinue}
              disabled={selectedChat === undefined}
              className="self-end rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {t.chatPicker.continue}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
