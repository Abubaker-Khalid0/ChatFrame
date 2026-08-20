import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ExportResult, StartImportRequest } from '@chatframe/shared';

/** sessionStorage key for the persisted workflow position + carried data. */
export const WORKFLOW_STORAGE_KEY = 'chatframe.workflow';

/**
 * The functional stages of the export pipeline. These replace the former route
 * segments; the dashboard renders exactly one at a time. `import-config` and
 * `import-progress` collapse to the "Import" rail node; `export` and
 * `export-complete` collapse to the "Export" rail node.
 */
export type WorkflowStage =
  | 'connect'
  | 'chat-picker'
  | 'import-config'
  | 'import-progress'
  | 'quality'
  | 'preview'
  | 'export'
  | 'export-complete';

/** Canonical forward order; also drives back/forward gating and the rail. */
export const STAGE_ORDER: readonly WorkflowStage[] = [
  'connect',
  'chat-picker',
  'import-config',
  'import-progress',
  'quality',
  'preview',
  'export',
  'export-complete',
];

/** Default landing stage for a fresh session — always starts at Connect. */
export const DEFAULT_STAGE: WorkflowStage = 'connect';

export interface SelectedChat {
  id: string;
  displayName: string | null;
  phoneNumber: string | null;
}

export interface WorkflowData {
  stage: WorkflowStage;
  selectedChat: SelectedChat | null;
  importId: string | null;
  projectId: string | null;
  importRequest: StartImportRequest | null;
  exportResult: ExportResult | null;
}

interface WorkflowActions {
  /** Generic navigation used by the rail and Back buttons (gated by canEnter). */
  goToStage: (stage: WorkflowStage) => void;
  /** Chat picker → import options, carrying the chat identity. */
  selectChat: (chat: SelectedChat) => void;
  /** Connect success → chat picker. */
  connected: () => void;
  /** Import options / retry → progress, carrying ids + the request for retry. */
  beginImport: (args: { importId: string; projectId: string; request: StartImportRequest }) => void;
  /** Import completed → quality. */
  completeImport: (projectId: string) => void;
  /** Quality → preview. */
  goToPreview: () => void;
  /** Preview → export. */
  goToExport: () => void;
  /** Export success → completion. */
  finishExport: (result: ExportResult) => void;
  /** Terminal import "Back to chat picker": drop the failed import, keep chat. */
  backToChatPicker: () => void;
  /** "Start new import": clear import/project/export, return to chat picker. */
  startNewImport: () => void;
  /** Full reset (used by tests and a hard restart). */
  reset: () => void;
}

export type WorkflowState = WorkflowData & WorkflowActions;

const INITIAL_DATA: WorkflowData = {
  stage: DEFAULT_STAGE,
  selectedChat: null,
  importId: null,
  projectId: null,
  importRequest: null,
  exportResult: null,
};

/**
 * Whether `stage` can be legally entered given the data currently carried.
 * Mirrors the old wizard's implicit prerequisites (a chat before import
 * options, a project before quality/preview/export, a result before the
 * completion screen) so a stale persisted stage can never render a broken
 * panel.
 */
export function canEnter(stage: WorkflowStage, data: WorkflowData): boolean {
  switch (stage) {
    case 'connect':
    case 'chat-picker':
      return true;
    case 'import-config':
      return data.selectedChat !== null;
    case 'import-progress':
      return data.importId !== null;
    case 'quality':
    case 'preview':
    case 'export':
      return data.projectId !== null;
    case 'export-complete':
      return data.projectId !== null && data.exportResult !== null;
    default:
      return false;
  }
}

/** Resolve to the highest stage ≤ the requested one that is actually enterable. */
export function resolveStage(requested: WorkflowStage, data: WorkflowData): WorkflowStage {
  let index = STAGE_ORDER.indexOf(requested);
  if (index < 0) {
    return DEFAULT_STAGE;
  }
  for (; index > 0; index -= 1) {
    const candidate = STAGE_ORDER[index]!;
    if (canEnter(candidate, data)) {
      return candidate;
    }
  }
  return STAGE_ORDER[0]!;
}

/**
 * Single source of truth for "where am I in the export flow" and the data that
 * flows between stages — replacing the former React Router `location.state`
 * chain. Persisted to sessionStorage so a browser refresh resumes the correct
 * stage with the real project/import ids (and never an invalid one).
 */
export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      ...INITIAL_DATA,

      goToStage: (stage) => set({ stage: resolveStage(stage, get()) }),

      selectChat: (chat) => set({ selectedChat: chat, stage: 'import-config' }),

      connected: () => set({ stage: 'chat-picker' }),

      beginImport: ({ importId, projectId, request }) =>
        set({ importId, projectId, importRequest: request, stage: 'import-progress' }),

      completeImport: (projectId) => set({ projectId, stage: 'quality' }),

      goToPreview: () => set({ stage: 'preview' }),

      goToExport: () => set({ stage: 'export' }),

      finishExport: (result) => set({ exportResult: result, stage: 'export-complete' }),

      backToChatPicker: () => set({ importId: null, importRequest: null, stage: 'chat-picker' }),

      startNewImport: () =>
        set({
          selectedChat: null,
          importId: null,
          projectId: null,
          importRequest: null,
          exportResult: null,
          stage: 'chat-picker',
        }),

      reset: () => set({ ...INITIAL_DATA }),
    }),
    {
      name: WORKFLOW_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        stage: state.stage,
        selectedChat: state.selectedChat,
        importId: state.importId,
        projectId: state.projectId,
        importRequest: state.importRequest,
        exportResult: state.exportResult,
      }),
      // On rehydrate, clamp the stage to one the carried data can actually
      // support — refresh recovery without invalid states.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<WorkflowData>;
        const data: WorkflowData = {
          stage: stored.stage ?? DEFAULT_STAGE,
          selectedChat: stored.selectedChat ?? null,
          importId: stored.importId ?? null,
          projectId: stored.projectId ?? null,
          importRequest: stored.importRequest ?? null,
          exportResult: stored.exportResult ?? null,
        };
        return { ...current, ...data, stage: resolveStage(data.stage, data) };
      },
    },
  ),
);
