import {
  CancelImportResponseSchema,
  ImportProgressSchema,
  StartImportResponseSchema,
  type CancelImportResponse,
  type ImportProgress,
  type StartImportRequest,
  type StartImportResponse,
} from '@chatframe/shared';
import { getJson, postJson } from './client';

/**
 * Import endpoints (contracts/import-api.md). All data flows through the
 * backend API — the frontend never touches WhatsApp or project files directly
 * (FR-023, Constitution XV). Responses are validated against the shared
 * schemas at the boundary (Constitution XIV). Live progress arrives over SSE
 * (`importEvents.ts`); `getImportStatus` is the late-join/self-heal fallback.
 */

/** Begins a new import (FR-013). `202` resolves; `409` rejects. */
export async function startImport(request: StartImportRequest): Promise<StartImportResponse> {
  return StartImportResponseSchema.parse(await postJson('/api/import/start', request));
}

/** Reads the live progress snapshot for a running import (FR-014). */
export async function getImportStatus(importId: string): Promise<ImportProgress> {
  return ImportProgressSchema.parse(
    await getJson(`/api/import/${encodeURIComponent(importId)}/status`),
  );
}

/** Requests cooperative cancellation of a running import (FR-015). */
export async function cancelImport(importId: string): Promise<CancelImportResponse> {
  return CancelImportResponseSchema.parse(
    await postJson(`/api/import/${encodeURIComponent(importId)}/cancel`, {}),
  );
}
