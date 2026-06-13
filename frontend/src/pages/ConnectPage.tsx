import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSessionEventsClient } from '../api/events';
import { useConnect, useLogout, useSessionStatus } from '../api/session.api';
import { ConnectionStatus } from '../components/session/ConnectionStatus';
import { DisclaimerBanner } from '../components/session/DisclaimerBanner';
import { QrPanel } from '../components/session/QrPanel';
import { useSessionStore } from '../stores/useSessionStore';
import { useTranslations } from '../i18n';

/**
 * WhatsApp connection screen (US1–US5). Loading this page requests the
 * current status — which triggers the backend health check and, when a saved
 * session exists, silent restore (FR-008) — and opens the SSE stream for
 * live updates (FR-011). "Connect WhatsApp" starts a fresh QR flow (FR-006);
 * on `connected` the wizard advances to the chat picker automatically.
 */
export function ConnectPage() {
  const t = useTranslations();
  const navigate = useNavigate();
  const sessionStatus = useSessionStatus();
  const connect = useConnect();
  const logout = useLogout();

  const state = useSessionStore((s) => s.state);
  const error = useSessionStore((s) => s.error);
  const channel = useSessionStore((s) => s.channel);
  const healthAvailable = useSessionStore((s) => s.healthAvailable);
  const applyStatus = useSessionStore((s) => s.applyStatus);

  const [actionError, setActionError] = useState<string | null>(null);

  // Live updates over SSE with auto-reconnect + polling fallback (FR-022).
  useEffect(() => {
    const client = createSessionEventsClient();
    client.start();
    return () => client.stop();
  }, []);

  // Seed the store from the status response (health check + restore result).
  useEffect(() => {
    if (sessionStatus.data !== undefined) {
      applyStatus(sessionStatus.data);
    }
  }, [sessionStatus.data, applyStatus]);

  // Once connected, advance to the chat picker step (US1 acceptance 2).
  useEffect(() => {
    if (state === 'connected') {
      navigate('/chat-picker');
    }
  }, [state, navigate]);

  const runAction = (mutation: typeof connect | typeof logout) => {
    setActionError(null);
    mutation.mutate(undefined, {
      onSuccess: (status) => applyStatus(status),
      onError: (mutationError: Error) => {
        // 409 = another tab's action is in progress (FR-023).
        setActionError(
          mutationError.message.includes('409')
            ? t.session.actionInProgress
            : t.session.actionFailed,
        );
      },
    });
  };

  const busy = connect.isPending || logout.isPending;
  // Logout / Unlink is offered in every state with something to unlink
  // (FR-014): connected, expired, failed, and while a QR is pending.
  const showLogout =
    state === 'connected' ||
    state === 'session_expired' ||
    state === 'connection_failed' ||
    state === 'qr_ready';

  return (
    <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <DisclaimerBanner />

      <h1 className="mt-6 text-2xl font-bold">{t.session.title}</h1>
      <p className="mt-2 text-gray-600">{t.session.subtitle}</p>

      {(channel === 'reconnecting' || channel === 'polling') && (
        <p className="mt-3 text-xs font-medium text-amber-600" data-testid="reconnecting-indicator">
          {t.session.reconnecting}
        </p>
      )}

      <div className="mt-6">
        <ConnectionStatus
          state={state}
          error={error}
          healthAvailable={healthAvailable}
          busy={busy}
          onConnect={() => runAction(connect)}
          onRetry={() => runAction(connect)}
          onReconnect={() => runAction(connect)}
          onProceed={() => navigate('/chat-picker')}
        />

        <QrPanel />

        {actionError !== null && (
          <p className="mt-4 text-sm text-red-600" role="alert" data-testid="action-error">
            {actionError}
          </p>
        )}

        {showLogout && (
          <button
            type="button"
            onClick={() => runAction(logout)}
            disabled={busy}
            className="mt-6 text-sm font-medium text-red-600 underline hover:text-red-700 disabled:opacity-50"
          >
            {t.session.logout}
          </button>
        )}
      </div>
    </section>
  );
}
