import { useQuery } from '@tanstack/react-query';
import { HealthStatusSchema, type HealthStatus } from '@chatframe/shared';
import { getJson } from './client';

/**
 * Queries the backend readiness endpoint and validates the response against the
 * shared schema (Constitution XIV). A network failure, non-2xx response, or an
 * invalid body surfaces as an error so the UI can show a clear "not ready"
 * state (FR-010).
 */
export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: async () => {
      const data = await getJson('/api/health');
      return HealthStatusSchema.parse(data);
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
