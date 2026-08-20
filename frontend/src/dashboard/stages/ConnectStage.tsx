import { useEffect, useState } from 'react';
import {
  Plug,
  RefreshCw,
  Smartphone,
  Link2,
  Plus,
  QrCode,
  Lock,
  Shield,
  ExternalLink,
  X,
  MessageCircle,
  Loader2,
  EyeOff,
} from 'lucide-react';
import { createSessionEventsClient } from '../../api/events';
import { useConnect, useSessionStatus } from '../../api/session.api';
import { useSessionStore } from '../../stores/useSessionStore';
import { useWorkflowStore } from '../../stores/useWorkflowStore';
import { useTranslations } from '../../i18n';
import { QrPanel } from '../../components/session/QrPanel';

/* ─────────────────────────────────────────────────────────────────────────────
 * ICONS for the instruction steps (stable across languages)
 * ───────────────────────────────────────────────────────────────────────────── */

const STEP_ICONS = [Smartphone, Link2, Plus, QrCode] as const;
const ABOUT_ICONS = [Lock, EyeOff, Shield] as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * CONNECT STAGE (High-Fidelity Dashboard UI)
 * ───────────────────────────────────────────────────────────────────────────── */

export function ConnectStage() {
  const t = useTranslations();
  const sessionStatus = useSessionStatus();
  const connect = useConnect();
  const workflowConnected = useWorkflowStore((s) => s.connected);

  const state = useSessionStore((s) => s.state);
  const qr = useSessionStore((s) => s.qr);
  const healthAvailable = useSessionStore((s) => s.healthAvailable);
  const applyStatus = useSessionStore((s) => s.applyStatus);

  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Live updates over SSE with auto-reconnect + polling fallback.
  useEffect(() => {
    const client = createSessionEventsClient();
    client.start();
    return () => client.stop();
  }, []);

  // Seed the store from the status response.
  useEffect(() => {
    if (sessionStatus.data !== undefined) {
      applyStatus(sessionStatus.data);
    }
  }, [sessionStatus.data, applyStatus]);

  // Once connected, advance to the chat picker stage.
  useEffect(() => {
    if (state === 'connected') {
      workflowConnected();
    }
  }, [state, workflowConnected]);

  const busy = connect.isPending;

  // Build the "How to connect" steps from translations
  const howToSteps = [
    { title: t.session.howToConnect.step1, subtitle: '' },
    { title: t.session.howToConnect.step2, subtitle: t.session.howToConnect.step2sub },
    { title: t.session.howToConnect.step3, subtitle: '' },
    { title: t.session.howToConnect.step4, subtitle: '' },
  ];

  // Build "About connection" items from translations
  const aboutItems = [
    { title: t.session.aboutConnection.privateTitle, desc: t.session.aboutConnection.privateDesc },
    {
      title: t.session.aboutConnection.readOnlyTitle,
      desc: t.session.aboutConnection.readOnlyDesc,
    },
    { title: t.session.aboutConnection.secureTitle, desc: t.session.aboutConnection.secureDesc },
  ];

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ─── MAIN CONTENT ─────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-4">
        <div className="w-full max-w-2xl">
          {/* Main QR Card */}
          <div className="rounded-[22px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
            <h1 className="text-xl font-bold text-ink">{t.session.title}</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
              {t.session.description}
            </p>

            {/* QR Code Area */}
            <div className="mt-5 flex justify-center">
              <div className="rounded-2xl border border-line p-3">
                <QrPanel />
                {/* Fallback placeholder when QrPanel returns null (no QR payload yet) */}
                {!qr && (
                  <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg bg-surface-muted">
                    <QrCode size={64} className="text-ink-muted/30" />
                  </div>
                )}
              </div>
            </div>

            {/* Status line */}
            <div className="mt-4 flex flex-col items-center gap-1">
              {state === 'qr_ready' || state === 'waiting_for_qr' ? (
                <>
                  <div className="flex items-center gap-2 text-accent">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-medium">{t.session.waitingForScan}</span>
                  </div>
                  <p className="text-xs text-ink-muted">{t.session.qrRefreshesAuto}</p>
                </>
              ) : state === 'disconnected' ? (
                <div className="flex items-center gap-2 text-ink-muted">
                  <span className="h-2 w-2 rounded-full bg-ink-muted" />
                  <span className="text-sm">{t.session.states.disconnected}</span>
                </div>
              ) : state === 'connecting' || state === 'initializing' ? (
                <div className="flex items-center gap-2 text-accent">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm font-medium">{t.session.states[state]}</span>
                </div>
              ) : state === 'connected' ? (
                <div className="flex items-center gap-2 text-success">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  <span className="text-sm font-medium">{t.session.states.connected}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-error">
                  <span className="h-2 w-2 rounded-full bg-error" />
                  <span className="text-sm">{t.session.states[state]}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex justify-center gap-3">
              {state === 'disconnected' && (
                <button
                  type="button"
                  onClick={() => connect.mutate(undefined, { onSuccess: (s) => applyStatus(s) })}
                  disabled={busy || healthAvailable === false}
                  className="inline-flex items-center gap-2 rounded-[14px] bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plug size={16} />
                  {t.session.connect}
                </button>
              )}
              {(state === 'connection_failed' || state === 'session_expired') && (
                <button
                  type="button"
                  onClick={() => connect.mutate(undefined, { onSuccess: (s) => applyStatus(s) })}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-[14px] bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={16} />
                  {t.session.reconnect}
                </button>
              )}
              {(state === 'qr_ready' || state === 'waiting_for_qr') && (
                <button
                  type="button"
                  onClick={() => connect.mutate(undefined, { onSuccess: (s) => applyStatus(s) })}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-[14px] border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
                >
                  <RefreshCw size={14} />
                  {t.session.refreshQr}
                </button>
              )}
            </div>
          </div>

          {/* WhatsApp Disclaimer Banner */}
          {showDisclaimer && (
            <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-accent-border bg-accent-soft px-5 py-3">
              <MessageCircle size={18} className="mt-0.5 shrink-0 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{t.session.disclaimerTitle}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
                  {t.session.disclaimerBody}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDisclaimer(false)}
                className="shrink-0 rounded-lg p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                aria-label={t.session.dismissDisclaimer}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT SIDEBAR ────────────────────────────────────────── */}
      <aside className="hidden w-[380px] shrink-0 overflow-y-auto border-s border-line bg-surface p-6 xl:block">
        {/* How to connect card */}
        <div className="rounded-[22px] border border-line bg-surface p-6">
          <h3 className="mb-5 text-lg font-bold text-ink">{t.session.howToConnect.title}</h3>
          <ol className="flex flex-col gap-4">
            {howToSteps.map((step, idx) => {
              const Icon = STEP_ICONS[idx]!;
              return (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {idx + 1}
                  </span>
                  <div className="flex items-start gap-2.5 pt-0.5">
                    <Icon size={18} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <p className="text-sm font-medium text-ink">{step.title}</p>
                      {step.subtitle && (
                        <p className="mt-0.5 text-xs text-ink-muted">{step.subtitle}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* About connection card */}
        <div className="mt-5 rounded-[22px] border border-line bg-surface p-6">
          <h3 className="mb-5 text-lg font-bold text-ink">{t.session.aboutConnection.title}</h3>
          <div className="flex flex-col gap-4">
            {aboutItems.map((item, idx) => {
              const Icon = ABOUT_ICONS[idx]!;
              return (
                <div key={idx} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                    <Icon size={18} className="text-accent" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Need help card */}
        <div className="mt-5 rounded-[22px] border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-ink">{t.session.needHelp.title}</h3>
              <p className="mt-1 text-xs text-ink-muted">{t.session.needHelp.description}</p>
            </div>
            <ExternalLink size={16} className="mt-0.5 shrink-0 text-ink-muted" />
          </div>
        </div>
      </aside>
    </div>
  );
}
