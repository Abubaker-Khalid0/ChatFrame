import { env } from '../config/env';
import { MockAdapter } from './MockAdapter';
import { WhatsappWebJsAdapter, type AdapterLogger } from './WhatsappWebJsAdapter';
import type { WhatsAppAdapter } from './WhatsAppAdapter';

let instance: WhatsAppAdapter | null = null;
let createdHook: ((adapter: WhatsAppAdapter) => void) | null = null;
let adapterLogger: AdapterLogger | undefined;

/**
 * Returns the active {@link WhatsAppAdapter}, selected by the `MOCK_MODE`
 * environment variable: `MockAdapter` in mock mode, the real
 * {@link WhatsappWebJsAdapter} singleton otherwise (FR-001). The instance is
 * created lazily and cached — one adapter, one Chromium process, one session
 * (research §7).
 */
export function getAdapter(): WhatsAppAdapter {
  if (instance === null) {
    instance = env.MOCK_MODE ? new MockAdapter() : new WhatsappWebJsAdapter(adapterLogger);
    createdHook?.(instance);
  }
  return instance;
}

/**
 * Registers a hook invoked for every adapter instance the factory creates
 * (and immediately for an existing one). Used by the session bootstrap to
 * wire SSE broadcasts so a re-created adapter (e.g. after logout) stays wired.
 */
export function setAdapterCreatedHook(hook: (adapter: WhatsAppAdapter) => void): void {
  createdHook = hook;
  if (instance !== null) {
    hook(instance);
  }
}

/** Supplies the sanitized logger handed to real adapter instances (FR-013). */
export function setAdapterLogger(logger: AdapterLogger): void {
  adapterLogger = logger;
}

/**
 * Fully tears down the current adapter (releasing the library client and the
 * Chromium process) and clears the cache, so the next {@link getAdapter} call
 * creates a fresh instance. Used by logout (FR-010) and rapid
 * connect/disconnect cycles (edge case: no leaked resources).
 */
export async function clearAdapter(): Promise<void> {
  const current = instance;
  instance = null;
  if (current !== null) {
    await current.destroy();
  }
}

/** Resets the cached adapter without teardown. Intended for tests. */
export function resetAdapter(): void {
  instance = null;
}
