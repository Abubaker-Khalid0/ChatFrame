import { create } from 'zustand';
import type { ImportProgress, SseImportErrorEvent, SseImportWarningEvent } from '@chatframe/shared';

/**
 * Live import state shared by the progress screen (007 FR-019, FR-020). Fed
 * by the import SSE client (`api/importEvents.ts`) and the status endpoint;
 * components only read from here. `progress.warnings` is the authoritative
 * cumulative list carried on progress snapshots; individual `import.warning`
 * events are merged in between snapshots so the list updates immediately.
 */
interface ImportStoreState {
  /** Latest progress snapshot, or `null` before/without an active import. */
  progress: ImportProgress | null;
  /** Human-readable accumulated non-fatal warnings. */
  warnings: string[];
  /** Fatal error payload from `import.error`, or `null`. */
  error: SseImportErrorEvent | null;

  applyProgress(progress: ImportProgress): void;
  applyWarning(event: SseImportWarningEvent): void;
  applyError(event: SseImportErrorEvent): void;
  reset(): void;
}

export const useImportStore = create<ImportStoreState>((set) => ({
  progress: null,
  warnings: [],
  error: null,

  applyProgress: (progress) =>
    set((current) => ({
      progress,
      // Snapshots carry the cumulative list; never lose a warning that
      // arrived as an event but missed a (throttled) snapshot.
      warnings:
        progress.warnings.length >= current.warnings.length ? progress.warnings : current.warnings,
    })),

  applyWarning: (event) =>
    set((current) =>
      current.warnings.includes(event.message)
        ? current
        : { warnings: [...current.warnings, event.message] },
    ),

  applyError: (event) => set({ error: event }),

  reset: () => set({ progress: null, warnings: [], error: null }),
}));
