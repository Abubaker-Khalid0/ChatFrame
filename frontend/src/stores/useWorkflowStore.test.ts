import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportResult, StartImportRequest } from '@chatframe/shared';
import {
  canEnter,
  resolveStage,
  useWorkflowStore,
  WORKFLOW_STORAGE_KEY,
  type WorkflowData,
} from './useWorkflowStore';

const request: StartImportRequest = {
  chatId: 'c1@c.us',
  chatDisplayName: 'Layla',
  options: { includeImages: false },
};

const result: ExportResult = {
  projectId: 'proj-1',
  exportDir: 'exports/html',
  htmlFilePath: 'exports/html/conversation.html',
  imageCount: 0,
  totalAssetSize: 10,
  durationMs: 5,
};

function data(overrides: Partial<WorkflowData> = {}): WorkflowData {
  return {
    stage: 'chat-picker',
    selectedChat: null,
    importId: null,
    projectId: null,
    importRequest: null,
    exportResult: null,
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  useWorkflowStore.getState().reset();
});

afterEach(() => {
  sessionStorage.clear();
});

describe('useWorkflowStore — gating (canEnter / resolveStage)', () => {
  it('allows connect and chat-picker unconditionally', () => {
    expect(canEnter('connect', data())).toBe(true);
    expect(canEnter('chat-picker', data())).toBe(true);
  });

  it('requires a selected chat for import-config', () => {
    expect(canEnter('import-config', data())).toBe(false);
    expect(
      canEnter(
        'import-config',
        data({ selectedChat: { id: 'c', displayName: null, phoneNumber: null } }),
      ),
    ).toBe(true);
  });

  it('requires a projectId for quality/preview/export', () => {
    for (const stage of ['quality', 'preview', 'export'] as const) {
      expect(canEnter(stage, data())).toBe(false);
      expect(canEnter(stage, data({ projectId: 'p' }))).toBe(true);
    }
  });

  it('requires both project and result for export-complete', () => {
    expect(canEnter('export-complete', data({ projectId: 'p' }))).toBe(false);
    expect(canEnter('export-complete', data({ projectId: 'p', exportResult: result }))).toBe(true);
  });

  it('resolves an unsupported stage back to the nearest valid one', () => {
    expect(resolveStage('export', data())).toBe('chat-picker');
    expect(resolveStage('export', data({ projectId: 'p' }))).toBe('export');
    expect(resolveStage('export-complete', data({ projectId: 'p' }))).toBe('export');
  });
});

describe('useWorkflowStore — transitions', () => {
  it('selectChat carries the chat and advances to import-config', () => {
    useWorkflowStore.getState().selectChat({ id: 'c1', displayName: 'Layla', phoneNumber: '+1' });
    const s = useWorkflowStore.getState();
    expect(s.stage).toBe('import-config');
    expect(s.selectedChat?.id).toBe('c1');
  });

  it('beginImport → completeImport → preview → export → finishExport', () => {
    const store = useWorkflowStore.getState();
    store.beginImport({ importId: 'imp_1', projectId: 'proj-1', request });
    expect(useWorkflowStore.getState().stage).toBe('import-progress');
    expect(useWorkflowStore.getState().importRequest).toEqual(request);

    store.completeImport('proj-1');
    expect(useWorkflowStore.getState().stage).toBe('quality');

    store.goToPreview();
    expect(useWorkflowStore.getState().stage).toBe('preview');

    store.goToExport();
    expect(useWorkflowStore.getState().stage).toBe('export');

    store.finishExport(result);
    expect(useWorkflowStore.getState().stage).toBe('export-complete');
    expect(useWorkflowStore.getState().exportResult).toEqual(result);
  });

  it('goToStage refuses an unreachable stage and clamps to a valid one', () => {
    useWorkflowStore.getState().goToStage('export');
    expect(useWorkflowStore.getState().stage).toBe('chat-picker');
  });

  it('backToChatPicker clears the failed import but keeps the chat', () => {
    useWorkflowStore.setState({
      selectedChat: { id: 'c1', displayName: 'Layla', phoneNumber: null },
      importId: 'imp_1',
      importRequest: request,
      stage: 'import-progress',
    });
    useWorkflowStore.getState().backToChatPicker();
    const s = useWorkflowStore.getState();
    expect(s.stage).toBe('chat-picker');
    expect(s.importId).toBeNull();
    expect(s.selectedChat?.id).toBe('c1');
  });

  it('startNewImport clears everything back to chat picker', () => {
    useWorkflowStore.setState({
      selectedChat: { id: 'c1', displayName: 'Layla', phoneNumber: null },
      projectId: 'proj-1',
      exportResult: result,
      stage: 'export-complete',
    });
    useWorkflowStore.getState().startNewImport();
    const s = useWorkflowStore.getState();
    expect(s.stage).toBe('chat-picker');
    expect(s.projectId).toBeNull();
    expect(s.exportResult).toBeNull();
    expect(s.selectedChat).toBeNull();
  });
});

describe('useWorkflowStore — refresh recovery', () => {
  it('clamps a persisted invalid stage to the nearest valid one on rehydrate', () => {
    // Simulate a refresh where the stage says "export" but no project survived.
    sessionStorage.setItem(
      WORKFLOW_STORAGE_KEY,
      JSON.stringify({ state: { stage: 'export', selectedChat: null }, version: 0 }),
    );
    useWorkflowStore.persist.rehydrate();
    expect(useWorkflowStore.getState().stage).toBe('chat-picker');
  });

  it('resumes a valid persisted stage with its carried ids', () => {
    sessionStorage.setItem(
      WORKFLOW_STORAGE_KEY,
      JSON.stringify({
        state: { stage: 'quality', projectId: 'proj-9' },
        version: 0,
      }),
    );
    useWorkflowStore.persist.rehydrate();
    const s = useWorkflowStore.getState();
    expect(s.stage).toBe('quality');
    expect(s.projectId).toBe('proj-9');
  });
});
