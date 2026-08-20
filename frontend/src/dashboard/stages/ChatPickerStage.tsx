import { useEffect, useRef, useState } from 'react';
import { phoneFromWhatsAppId, type ConnectionState, type ChatSummary, type StartImportRequest } from '@chatframe/shared';
import {
  Upload,
  Search,
  FileText,
  Image,
  Info,
  RefreshCw,
  Loader2,
  WifiOff,
  AlertCircle,
  Download,
} from 'lucide-react';
import { isNotConnectedError, useChats } from '../../api/chats.api';
import { startImport } from '../../api/import.api';
import { useSessionStore } from '../../stores/useSessionStore';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useImportStore } from '../../stores/useImportStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useTranslations } from '../../i18n';
import { chatFilter } from '../../components/chats/chatFilter';
import { ChatAvatar } from '../../components/chats/ChatAvatar';
import { formatRelativeTime } from '../../lib/relativeTime';
import emptyStateImg from '../../assets/img.png';
import emptyStateImgDark from '../../assets/img2.png';

/** Session states that mean the live connection is gone (FR-016). */
const FAILED_SESSION_STATES: ReadonlySet<ConnectionState> = new Set([
  'disconnected',
  'session_expired',
  'connection_failed',
]);

/**
 * Chat selection workspace stage — the main three-column workspace view.
 * Connected to the real backend API via useChats() hook.
 */
export function ChatPickerStage() {
  const t = useTranslations();
  const { data: chats, isLoading, isError, error, refetch } = useChats();
  const selectChat = useWorkflowStore((s) => s.selectChat);
  const beginImport = useWorkflowStore((s) => s.beginImport);
  const goToStage = useWorkflowStore((s) => s.goToStage);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [images, setImages] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(false);

  // Live-disconnect detection
  const sessionState = useSessionStore((s) => s.state);
  const sawActiveSession = useRef(false);
  useEffect(() => {
    if (!FAILED_SESSION_STATES.has(sessionState)) {
      sawActiveSession.current = true;
    }
  }, [sessionState]);
  const sessionLost = FAILED_SESSION_STATES.has(sessionState) && sawActiveSession.current;

  const isNotConnected = sessionLost || (isError && isNotConnectedError(error));

  const visibleChats = chatFilter(chats ?? [], searchTerm);
  const selectedChat = (chats ?? []).find((chat) => chat.id === selectedId) ?? null;

  const handleContinue = async () => {
    if (!selectedChat || importing) return;

    // Select the chat in the workflow store
    selectChat({
      id: selectedChat.id,
      displayName: selectedChat.displayName,
      phoneNumber: selectedChat.phoneNumber,
    });

    // Start the import directly
    setImporting(true);
    setImportError(false);

    const request: StartImportRequest = {
      chatId: selectedChat.id,
      ...(selectedChat.displayName !== null ? { chatDisplayName: selectedChat.displayName } : {}),
      ...(selectedChat.phoneNumber !== null ? { chatPhoneNumber: selectedChat.phoneNumber } : {}),
      options: { includeImages: images },
    };

    try {
      const response = await startImport(request);
      useImportStore.getState().reset();
      beginImport({
        importId: response.importId,
        projectId: response.projectId,
        request,
      });
    } catch {
      setImportError(true);
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3.5 overflow-hidden p-3.5">
      {/* Three-Column Workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_350px] gap-3.5">
        {/* Left: Chat List Panel */}
        <div className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
          {/* Chat list header */}
          <div className="shrink-0 border-b border-line px-4 pt-4 pb-3">
            <h2 className="mb-3 text-[16px] font-bold text-ink">{t.chatPicker.title}</h2>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.chatPicker.searchPlaceholder}
                  className="h-9 w-full rounded-[8px] border border-line bg-surface-muted pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-muted transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Chat rows */}
          <div className="flex-1 overflow-y-auto">
            {isNotConnected && (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <WifiOff size={32} className="text-ink-muted" />
                <p className="text-[13px] text-ink-secondary">{t.chatPicker.notConnected}</p>
                <button
                  type="button"
                  onClick={() => goToStage('connect')}
                  className="rounded-[8px] bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  {t.chatPicker.goToConnection}
                </button>
              </div>
            )}

            {!isNotConnected && isLoading && (
              <div className="flex flex-col items-center gap-3 px-4 py-10">
                <Loader2 size={24} className="animate-spin text-accent" />
                <p className="text-[13px] text-ink-secondary">{t.chatPicker.loading}</p>
              </div>
            )}

            {!isNotConnected && isError && !isNotConnectedError(error) && (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <AlertCircle size={32} className="text-error" />
                <p className="text-[13px] text-ink-secondary">{t.chatPicker.fetchError}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded-[8px] border border-line px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-hover"
                >
                  {t.chatPicker.retry}
                </button>
              </div>
            )}

            {!isNotConnected && !isLoading && !isError && visibleChats.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <p className="text-[13px] text-ink-secondary">
                  {searchTerm.trim() ? t.chatPicker.searchEmpty : t.chatPicker.empty}
                </p>
              </div>
            )}

            {!isNotConnected && !isLoading && !isError && visibleChats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                selected={selectedId === chat.id}
                onClick={() => setSelectedId(chat.id)}
              />
            ))}
          </div>

          {/* Chat list footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-line px-4 py-2.5">
            <span className="text-[12px] text-ink-secondary">
              {chats ? t.chatPicker.chatsCount.replace('{count}', String(chats.length)) : '—'}
            </span>
            <div className="flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <button
                type="button"
                onClick={() => void refetch()}
                className="flex items-center gap-1 text-ink-secondary transition-colors hover:text-ink"
              >
                <RefreshCw size={12} />
                <span>{t.chatPicker.refresh}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center: Empty State / Selected Chat Canvas */}
        <div className="flex flex-col items-center justify-center overflow-hidden rounded-[14px] border border-line bg-surface">
          {selectedChat ? (
            <div className="flex flex-col items-center px-6 text-center">
              <ChatAvatar displayName={selectedChat.displayName} phoneNumber={selectedChat.phoneNumber} />
              <h2 className="mt-4 text-[18px] font-bold text-ink">
                {selectedChat.displayName ?? selectedChat.phoneNumber ?? phoneFromWhatsAppId(selectedChat.id) ?? t.chatPicker.unknownContact}
              </h2>
              {selectedChat.phoneNumber && (
                <p className="mt-1 text-[13px] text-ink-secondary">{selectedChat.phoneNumber}</p>
              )}
              {selectedChat.lastMessagePreview && (
                <p className="mt-2 max-w-[320px] text-[13px] text-ink-muted">
                  "{selectedChat.lastMessagePreview}"
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleContinue()}
                disabled={importing}
                className="mt-6 flex items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {importing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                <span>{importing ? t.import.progress.title : t.chatPicker.startImport}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 text-center">
              <EmptyStateIllustration />
              <h2 className="mt-6 text-[18px] font-bold text-ink">{t.chatPicker.startNewImport}</h2>
              <p className="mt-2 max-w-[320px] text-[13px] leading-relaxed text-ink-secondary">
                {t.chatPicker.startNewImportDesc}
              </p>
            </div>
          )}
        </div>

        {/* Right: Import Options */}
        <div className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="shrink-0 border-b border-line px-4 py-3">
            <h3 className="text-[14px] font-bold text-ink">{t.chatPicker.importOptions}</h3>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Text messages — always included */}
            <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface-muted px-3.5 py-3">
              <FileText size={16} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">{t.chatPicker.textMessages}</p>
                <p className="text-[11px] text-ink-muted">{t.chatPicker.textMessagesDesc}</p>
              </div>
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                {t.import.options.textAlwaysOn}
              </span>
            </div>

            {/* Images — toggleable */}
            <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-line px-3.5 py-3">
              <Image size={16} className="shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">{t.chatPicker.images}</p>
                <p className="text-[11px] text-ink-muted">{t.chatPicker.imagesDesc}</p>
              </div>
              <button
                type="button"
                role="switch"
                dir="ltr"
                aria-checked={images}
                onClick={() => setImages(!images)}
                className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors ${
                  images ? 'bg-accent' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
                    images ? 'translate-x-[20px]' : 'translate-x-[2px]'
                  }`}
                />
              </button>
            </div>

            {/* Info banner when no chat selected */}
            {!selectedChat && (
              <div className="mt-4 flex items-center gap-2.5 rounded-[10px] border border-info/30 bg-info-soft px-3.5 py-2.5">
                <Info size={15} className="shrink-0 text-info" />
                <span className="text-[12px] text-ink-secondary">{t.chatPicker.selectChatToImport}</span>
              </div>
            )}
          </div>

          {/* Start Import button */}
          <div className="shrink-0 border-t border-line px-4 py-3">
            {importError && (
              <p className="mb-2 text-[12px] text-error">{t.import.options.startError}</p>
            )}
            <button
              type="button"
              disabled={!selectedChat || importing}
              onClick={() => void handleContinue()}
              className={`flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold transition-colors ${
                selectedChat && !importing
                  ? 'bg-accent text-white hover:bg-accent-hover'
                  : 'bg-surface-muted text-ink-muted cursor-not-allowed'
              }`}
            >
              {importing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              <span>{importing ? t.import.progress.title : t.chatPicker.startImport}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Sub-components ─────────── */

function ChatRow({
  chat,
  selected,
  onClick,
}: {
  chat: ChatSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const language = useLanguageStore((s) => s.language);
  const t = useTranslations();
  const name = chat.displayName ?? chat.phoneNumber ?? phoneFromWhatsAppId(chat.id) ?? t.chatPicker.unknownContact;
  const locale = language === 'ar' ? 'ar' : 'en-US';
  const time = chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt, locale) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-start transition-colors ${
        selected ? 'bg-accent-soft' : 'hover:bg-surface-hover'
      }`}
    >
      <ChatAvatar displayName={chat.displayName} phoneNumber={chat.phoneNumber} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-[14px] font-semibold text-ink">{name}</span>
          {time && <span className="shrink-0 text-[11px] text-ink-muted">{time}</span>}
        </div>
        {chat.lastMessagePreview && (
          <div className="mt-0.5 flex items-center justify-between">
            <span className="truncate text-[12px] text-ink-secondary">{chat.lastMessagePreview}</span>
          </div>
        )}
      </div>
    </button>
  );
}

/** Soft empty-state illustration for the center canvas */
/** Soft empty-state illustration for the center canvas */
function EmptyStateIllustration() {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div className="flex items-center justify-center">
      <img
        src={theme === 'dark' ? emptyStateImgDark : emptyStateImg}
        alt=""
        aria-hidden="true"
        className="h-[200px] w-auto object-contain rounded-[16px]"
      />
    </div>
  );
}
