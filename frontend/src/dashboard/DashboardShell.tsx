import { type ReactNode, useEffect, useRef } from 'react';
import { useLanguageStore } from '../stores/useLanguageStore';
import { useWorkflowStore, type WorkflowStage } from '../stores/useWorkflowStore';
import { useSessionStatus } from '../api/session.api';
import { WorkflowRail } from './WorkflowRail';
import { TopBar } from './TopBar';
import { WelcomeStage } from './stages/WelcomeStage';
import { ConnectStage } from './stages/ConnectStage';
import { ChatPickerStage } from './stages/ChatPickerStage';
import { ImportConfigStage } from './stages/ImportConfigStage';
import { ImportProgressStage } from './stages/ImportProgressStage';
import { QualityStage } from './stages/QualityStage';
import { PreviewStage } from './stages/PreviewStage';
import { ExportStage } from './stages/ExportStage';
import { ExportCompleteStage } from './stages/ExportCompleteStage';

const STAGE_VIEWS: Record<WorkflowStage, () => ReactNode> = {
  connect: () => <ConnectStage />,
  'chat-picker': () => <ChatPickerStage />,
  'import-config': () => <ImportConfigStage />,
  'import-progress': () => <ImportProgressStage />,
  quality: () => <QualityStage />,
  preview: () => <PreviewStage />,
  export: () => <ExportStage />,
  'export-complete': () => <ExportCompleteStage />,
};

/** States that indicate the user is NOT connected to WhatsApp. */
const NOT_CONNECTED_STATES = new Set(['disconnected', 'session_expired', 'connection_failed']);

/**
 * The unified dashboard shell. Renders a premium SaaS app-frame with:
 * - Full outer rounded container (desktop)
 * - Left workflow stepper rail
 * - Top header bar
 * - Main content area (stage-specific, may include a right info sidebar)
 */
export function DashboardShell() {
  const hasChosen = useLanguageStore((s) => s.hasChosen);
  const stage = useWorkflowStore((s) => s.stage);
  const goToStage = useWorkflowStore((s) => s.goToStage);

  // Check session status on mount to auto-redirect to connect if not linked.
  const { data: sessionStatus } = useSessionStatus();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (didRedirect.current || !sessionStatus) return;
    // Only redirect if the user is on the default landing stage (chat-picker)
    // and the backend confirms they're not connected.
    if (stage === 'chat-picker' && NOT_CONNECTED_STATES.has(sessionStatus.state)) {
      didRedirect.current = true;
      goToStage('connect');
    }
  }, [sessionStatus, stage, goToStage]);

  if (!hasChosen) {
    return <WelcomeStage />;
  }

  return (
    <div className="flex h-full items-center justify-center bg-workspace p-3 md:p-5">
      {/* Outer app shell with large radius */}
      <div className="flex h-full w-full overflow-hidden rounded-[28px] border border-line bg-surface shadow-[var(--shadow-card)]">
        <WorkflowRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-hidden">{STAGE_VIEWS[stage]()}</main>
        </div>
      </div>
    </div>
  );
}
