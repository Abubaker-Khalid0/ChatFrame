import { useLocation, useNavigate } from 'react-router-dom';
import { ConversationPreview } from '../components/preview/ConversationPreview';
import { PreviewToolbar } from '../components/preview/PreviewToolbar';
import { useTranslations } from '../i18n';
import '../styles/chat-renderer.css';

/** Fallback identifier when no import forwarded a real project (mock flow). */
const MOCK_PROJECT_ID = 'mock-project';

/**
 * Wizard step 4: the WhatsApp-like preview (008 FR-006). A phone-width
 * conversation panel centered in the desktop shell renders the paginated
 * conversation. A completed import forwards its `projectId` via navigation
 * state; without one the screen falls back to the mock project.
 */
export function PreviewPage() {
  const t = useTranslations();
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = (location.state as { projectId?: string } | null)?.projectId ?? MOCK_PROJECT_ID;

  return (
    <section className="flex h-[86vh] w-full max-w-5xl flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold">{t.preview.title}</h1>
      </header>

      <PreviewToolbar projectId={projectId} />

      <div className="min-h-0 flex-1">
        <div className="cf-chat-shell">
          <ConversationPreview projectId={projectId} />
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
        <button
          type="button"
          onClick={() => navigate('/quality', { state: { projectId } })}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
        >
          {t.wizard.back}
        </button>
        <button
          type="button"
          onClick={() => navigate('/export', { state: { projectId } })}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {t.wizard.continue}
        </button>
      </footer>
    </section>
  );
}
