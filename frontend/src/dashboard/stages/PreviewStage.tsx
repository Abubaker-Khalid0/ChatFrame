import { useCallback, useRef, useState } from 'react';
import {
  Search,
  Moon,
  Sun,
  Upload,
} from 'lucide-react';
import { phoneFromWhatsAppId, type ChatSummary, type ExportHtmlRequest } from '@chatframe/shared';
import { useChats } from '../../api/chats.api';
import { useExportHtml } from '../../api/export.api';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useLanguageStore } from '../../stores/useLanguageStore';
import { usePreviewSettingsStore } from '../../stores/usePreviewSettingsStore';
import { useTranslations } from '../../i18n';
import { ChatAvatar } from '../../components/chats/ChatAvatar';
import { chatFilter } from '../../components/chats/chatFilter';
import { formatRelativeTime } from '../../lib/relativeTime';
import { ConversationPreview } from '../../components/preview/ConversationPreview';
import { ExportingModal } from '../../components/export/ExportingModal';
import '../../styles/chat-renderer.css';

/**
 * Preview stage — three-column workspace: settings panel, conversation preview,
 * and chat list. All settings are wired to the real stores and affect the
 * conversation preview in real-time.
 */
export function PreviewStage() {
  const t = useTranslations();
  const language = useLanguageStore((s) => s.language);
  const projectId = useWorkflowStore((s) => s.projectId) ?? '';
  const selectedChat = useWorkflowStore((s) => s.selectedChat);
  const finishExport = useWorkflowStore((s) => s.finishExport);
  const goToStage = useWorkflowStore((s) => s.goToStage);

  const { data: chats } = useChats();
  const [searchTerm, setSearchTerm] = useState('');

  // Real settings from store
  const privacy = usePreviewSettingsStore((s) => s.privacy);
  const setPrivacy = usePreviewSettingsStore((s) => s.setPrivacy);
  const theme = usePreviewSettingsStore((s) => s.theme);
  const setTheme = usePreviewSettingsStore((s) => s.setTheme);
  const showWatermark = usePreviewSettingsStore((s) => s.showWatermark);
  const setShowWatermark = usePreviewSettingsStore((s) => s.setShowWatermark);

  const visibleChats = chatFilter(chats ?? [], searchTerm);

  // Export
  const exportMutation = useExportHtml(projectId);

  function buildExportRequest(): ExportHtmlRequest {
    const alias = privacy.displayAlias?.trim();
    return {
      settings: {
        showContactName: privacy.showContactName,
        showPhoneNumber: privacy.showPhoneNumber,
        ...(alias !== undefined && alias.length > 0 ? { displayAlias: alias } : {}),
        showWatermark,
        theme,
      },
      locale: language,
    };
  }

  function startExport() {
    exportMutation.mutate(buildExportRequest(), {
      onSuccess: (result) => finishExport(result),
    });
  }

  const exportModalVisible = exportMutation.isPending || exportMutation.isError;

  // Resizable panel widths
  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(300);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Detect if the document is in RTL mode */
  const isRtl = () => document.documentElement.dir === 'rtl' || document.body.dir === 'rtl';

  const handleResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const rtl = isRtl();
    const onMove = (ev: MouseEvent) => {
      const rawDelta = ev.clientX - startX;
      const delta = rtl ? -rawDelta : rawDelta;
      const newWidth = Math.max(180, Math.min(450, startWidth + delta));
      setLeftWidth(newWidth);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [leftWidth]);

  const handleResizeRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    const rtl = isRtl();
    const onMove = (ev: MouseEvent) => {
      const rawDelta = startX - ev.clientX;
      const delta = rtl ? -rawDelta : rawDelta;
      const newWidth = Math.max(200, Math.min(450, startWidth + delta));
      setRightWidth(newWidth);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [rightWidth]);

  return (
    <div className="flex h-full flex-col overflow-hidden p-3.5">
      {/* Three-Column Workspace with resizable panels */}
      <div ref={containerRef} className="flex min-h-0 flex-1 gap-0">
        {/* ─── Left: Chat List ─── */}
        <div style={{ width: leftWidth, minWidth: 200 }} className="flex shrink-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
          {/* Header */}
          <div className="shrink-0 border-b border-line px-4 pt-3 pb-2.5">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t.chatPicker.searchPlaceholder}
                className="h-8 w-full rounded-[8px] border border-line bg-surface-muted pl-8 pr-3 text-[12px] text-ink placeholder:text-ink-muted transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Chat rows */}
          <div className="flex-1 overflow-y-auto">
            {visibleChats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                selected={selectedChat?.id === chat.id}
                language={language}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-line px-3 py-2">
            <span className="text-[11px] text-ink-muted">
              Last added: {new Date().toLocaleTimeString(language === 'ar' ? 'ar' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[11px] text-ink-secondary">
              chats {chats?.length ?? 0}
            </span>
          </div>
        </div>

        {/* ─── Left Resize Handle ─── */}
        <div
          onMouseDown={handleResizeLeft}
          className="flex w-[6px] shrink-0 cursor-col-resize items-center justify-center hover:bg-surface-hover active:bg-surface-muted transition-colors"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize left panel"
        >
          <div className="h-8 w-[3px] rounded-full bg-line-strong" />
        </div>

        {/* ─── Center: Conversation Preview ─── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line">
          <div className="min-h-0 flex-1">
            <div className="cf-chat-shell" style={{ padding: 0, borderRadius: 0 }}>
              <ConversationPreview projectId={projectId} />
            </div>
          </div>
        </div>

        {/* ─── Right Resize Handle ─── */}
        <div
          onMouseDown={handleResizeRight}
          className="flex w-[6px] shrink-0 cursor-col-resize items-center justify-center hover:bg-surface-hover active:bg-surface-muted transition-colors"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
        >
          <div className="h-8 w-[3px] rounded-full bg-line-strong" />
        </div>

        {/* ─── Right: Settings Panel ─── */}
        <div style={{ width: rightWidth, minWidth: 180 }} className="flex shrink-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="shrink-0 border-b border-line px-4 py-3">
            <h3 className="text-[14px] font-bold text-ink">{t.export.settings.title}</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* Privacy settings */}
            <div className="flex flex-col gap-3">
              <SettingRow label={t.export.settings.showContactName}>
                <ToggleSwitch
                  checked={privacy.showContactName}
                  onChange={(v) => setPrivacy({ ...privacy, showContactName: v })}
                />
              </SettingRow>
              <SettingRow label={t.export.settings.showPhoneNumber}>
                <ToggleSwitch
                  checked={privacy.showPhoneNumber}
                  onChange={(v) => setPrivacy({ ...privacy, showPhoneNumber: v })}
                />
              </SettingRow>
              {/* Display alias */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-ink-secondary">{t.export.settings.displayAlias}</span>
                <input
                  type="text"
                  value={privacy.displayAlias ?? ''}
                  placeholder={t.export.settings.displayAliasPlaceholder}
                  onChange={(e) => {
                    const alias = e.target.value;
                    setPrivacy(
                      alias.trim().length > 0
                        ? { ...privacy, displayAlias: alias }
                        : { showContactName: privacy.showContactName, showPhoneNumber: privacy.showPhoneNumber },
                    );
                  }}
                  className="h-7 w-[110px] rounded-[6px] border border-line bg-surface-muted px-2 text-[12px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
              </div>
              <SettingRow label={t.export.settings.watermarkLabel}>
                <ToggleSwitch
                  checked={showWatermark}
                  onChange={setShowWatermark}
                />
              </SettingRow>
              <SettingRow label={t.export.settings.themeTitle}>
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="flex h-7 items-center gap-1.5 rounded-[6px] border border-line bg-surface-muted px-2.5 text-[11px] font-medium text-ink transition-colors hover:bg-surface-hover"
                >
                  {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                  <span>{theme === 'dark' ? t.export.settings.themeDark : t.export.settings.themeLight}</span>
                </button>
              </SettingRow>
            </div>

            {/* Info note */}
            <p className="mt-4 text-[10px] text-ink-muted">
              {t.export.settings.fakeAvatarNote}
            </p>
          </div>

          {/* Export button */}
          <div className="shrink-0 border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={startExport}
              disabled={exportMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#16A34A] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0F7133] disabled:opacity-60"
            >
              <Upload size={15} />
              <span>{t.export.settings.exportButton}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Export modal */}
      {exportModalVisible && (
        <ExportingModal
          error={exportMutation.isError ? t.export.modal.errorBody : null}
          onRetry={startExport}
          onBack={() => goToStage('preview')}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════════════════════ */

function ChatRow({
  chat,
  selected,
  language,
}: {
  chat: ChatSummary;
  selected: boolean;
  language: string;
}) {
  const t = useTranslations();
  const name = chat.displayName ?? chat.phoneNumber ?? phoneFromWhatsAppId(chat.id) ?? t.chatPicker.unknownContact;
  const locale = language === 'ar' ? 'ar' : 'en-US';
  const time = chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt, locale) : null;

  return (
    <div
      className={`flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-start transition-colors ${
        selected ? 'bg-accent-soft' : 'hover:bg-surface-hover'
      }`}
    >
      <ChatAvatar displayName={chat.displayName} phoneNumber={chat.phoneNumber} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
          {time && <span className="shrink-0 text-[10px] text-ink-muted">{time}</span>}
        </div>
        {chat.lastMessagePreview && (
          <span className="mt-0.5 block truncate text-[11px] text-ink-secondary">{chat.lastMessagePreview}</span>
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 text-[12px] text-ink-secondary">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      dir="ltr"
      className={`relative inline-flex h-[20px] w-[36px] shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-[#16A34A]' : 'bg-[#D5DED7]'
      }`}
    >
      <span
        className={`inline-block h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}
