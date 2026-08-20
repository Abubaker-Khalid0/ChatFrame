import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SessionStatusSchema, type SessionStatus } from '@chatframe/shared';
import { getJson, postJson } from './client';
import { useSessionStore } from '../stores/useSessionStore';

/**
 * Session endpoints (contracts/session-api.md). Responses are validated
 * against the shared schema at the boundary (Constitution XIV). The status
 * query runs once when the connection screen loads — that first call also
 * triggers the backend health check and silent session restore (FR-008,
 * FR-024); live updates afterwards arrive via SSE, not polling.
 */

export async function fetchSessionStatus(): Promise<SessionStatus> {
  return SessionStatusSchema.parse(await getJson('/api/session/status'));
}

export function useSessionStatus() {
  return useQuery<SessionStatus>({
    queryKey: ['session', 'status'],
    queryFn: fetchSessionStatus,
    // SSE is the live channel; the query only seeds the initial state.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
}

export function useConnect() {
  return useMutation<SessionStatus>({
    mutationFn: async () => SessionStatusSchema.parse(await postJson('/api/session/connect', {})),
  });
}

/**
 * Logs out the WhatsApp session. On success the session store is immediately
 * updated with the backend response (which carries `state: 'disconnected'`),
 * and the cached session status query is invalidated. This ensures the UI
 * reflects the disconnection even when the SSE client is not active (the SSE
 * listener only runs on the Connect stage, but the logout button is in the
 * TopBar which lives on all stages).
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<SessionStatus>({
    mutationFn: async () => SessionStatusSchema.parse(await postJson('/api/session/logout', {})),
    onSuccess: (status) => {
      useSessionStore.getState().applyStatus(status);
      void queryClient.invalidateQueries({ queryKey: ['session', 'status'] });
    },
  });
}
