import { mkdir, readFile, rm } from 'node:fs/promises';
import { listFilesRecursively } from '../security/sessionProtection';
import { whatsappWebJsSessionPath } from '../config/paths';

/**
 * Session file lifecycle (FR-018, Constitution XIII). The actual session
 * payload is written by `whatsapp-web.js` `LocalAuth` under
 * {@link whatsappWebJsSessionPath}; this module owns creation of the
 * directory, existence checks, reads, and — critically — thorough deletion on
 * logout (SC-004: zero files remain).
 */

/** Creates the session directory if needed and returns its absolute path. */
export async function ensureSessionDir(): Promise<string> {
  const dir = whatsappWebJsSessionPath();
  await mkdir(dir, { recursive: true });
  return dir;
}

/** True when any session file exists from a previous connection (FR-008). */
export async function sessionExists(): Promise<boolean> {
  const files = await listFilesRecursively(whatsappWebJsSessionPath());
  return files.length > 0;
}

/** Lists all session files (absolute paths); [] when no session exists. */
export async function listSessionFiles(): Promise<string[]> {
  return listFilesRecursively(whatsappWebJsSessionPath());
}

/** Reads a single session file as UTF-8, or `null` when unreadable/absent. */
export async function readSessionFile(absolutePath: string): Promise<string | null> {
  try {
    return await readFile(absolutePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Securely clears the session: removes the whole session subtree so zero
 * session-related files remain (FR-018, SC-004). Idempotent — a missing
 * directory is already clear.
 */
export async function clearSession(): Promise<void> {
  await rm(whatsappWebJsSessionPath(), { recursive: true, force: true });
}
