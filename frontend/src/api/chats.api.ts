import { useQuery } from '@tanstack/react-query';
import { ChatsResponseSchema, type ChatSummary } from '@chatframe/shared';
import { ApiError, getJson } from './client';

/**
 * True when a chats fetch failed because the WhatsApp session is not
 * connected (`409 SESSION_NOT_CONNECTED`, FR-006) — the picker offers a
 * reconnect action instead of a retry (FR-015, FR-016).
 */
export function isNotConnectedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'SESSION_NOT_CONNECTED';
}

/**
 * Fetches the list of private chats and validates the response against the
 * shared schema (Constitution XIV). An empty list is a valid result and is
 * handled by the UI as a "no chats" state. The query result's `refetch`
 * drives the Retry action (FR-015).
 *
 * Stale-while-revalidate (FR-020, SC-010): on return navigation the cached
 * list paints immediately (no spinner) while a silent background refetch runs
 * once the short freshness window has passed. `gcTime` keeps the cache alive
 * across wizard navigation.
 */
export function useChats() {
  return useQuery<ChatSummary[]>({
    queryKey: ['chats', 'private'],
    queryFn: async () => {
      const data = await getJson('/api/chats/private');
      return ChatsResponseSchema.parse(data).chats;
    },
    staleTime: 5_000,
    gcTime: 10 * 60_000,
    // Retrying cannot fix a disconnected session — surface it immediately.
    retry: (failureCount, error) => !isNotConnectedError(error) && failureCount < 2,
  });
}
