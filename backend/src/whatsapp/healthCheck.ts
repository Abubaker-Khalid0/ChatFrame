import { createRequire } from 'node:module';
import type { HealthCheckResult } from '@chatframe/shared';
import { env } from '../config/env';

/**
 * Chromium/Puppeteer health check (FR-024, SC-012): a lightweight launch that
 * verifies the headless browser can start before the user is offered the
 * "Connect" button. In mock mode no browser is needed, so the check passes
 * immediately.
 *
 * Puppeteer is a dependency of `whatsapp-web.js` (not a direct dependency of
 * the backend — research §2), so it is resolved through the library's own
 * module tree to guarantee the exact version the adapter will use.
 */

interface MinimalBrowser {
  close(): Promise<void>;
}

interface MinimalPuppeteer {
  launch(options?: { headless?: boolean }): Promise<MinimalBrowser>;
}

function loadPuppeteer(): MinimalPuppeteer {
  const requireHere = createRequire(import.meta.url);
  const wwebjsEntry = requireHere.resolve('whatsapp-web.js');
  const requireFromWwebjs = createRequire(wwebjsEntry);
  return requireFromWwebjs('puppeteer') as MinimalPuppeteer;
}

/** Runs the health check and returns a project-owned result (never throws). */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const checkedAt = new Date().toISOString();

  if (env.MOCK_MODE) {
    return { available: true, checkedAt, error: null };
  }

  try {
    const puppeteer = loadPuppeteer();
    const browser = await puppeteer.launch({ headless: true });
    await browser.close();
    return { available: true, checkedAt, error: null };
  } catch (error) {
    // Diagnostic detail stays server-side for debugging (FR-025); the routes
    // surface only a user-friendly message.
    const message = error instanceof Error ? error.message : String(error);
    return { available: false, checkedAt, error: `Failed to launch Chromium: ${message}` };
  }
}
