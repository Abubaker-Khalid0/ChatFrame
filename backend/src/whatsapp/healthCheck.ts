import type { HealthCheckResult } from '@chatframe/shared';
import { env } from '../config/env';

/**
 * Health check (FR-024, SC-012): verifies that the WhatsApp integration
 * backend is ready to accept connections. With Baileys (WebSocket-based),
 * there is no Chromium dependency — the check validates that the Node.js
 * process can establish outbound network connections.
 *
 * In mock mode the check passes immediately.
 */

/** Runs the health check and returns a project-owned result (never throws). */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const checkedAt = new Date().toISOString();

  if (env.MOCK_MODE) {
    return { available: true, checkedAt, error: null };
  }

  // Baileys uses WebSocket — no Chromium launch needed. Verify basic network
  // connectivity by checking that we can resolve the WhatsApp server hostname.
  try {
    const { promises: dns } = await import('node:dns');
    await dns.resolve4('web.whatsapp.com');
    return { available: true, checkedAt, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { available: false, checkedAt, error: `Network check failed: ${message}` };
  }
}
