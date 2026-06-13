import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRenderModel } from '../normalization/RenderModelBuilder';
import { mockMessages } from '../whatsapp/fixtures/mock-messages';
import { exportHtml } from './HtmlExporter';

/**
 * 010 US7 / T052 — export session exclusion audit (contracts §3).
 *
 * Decoy session artifacts are planted INSIDE the project folder (worst case:
 * even though real session data lives outside the project tree), an export is
 * generated, and the output tree is scanned recursively: zero session
 * artifacts, and only allow-listed file types, may exist in the archive.
 */

const SESSION_DECOYS = ['.wwebjs_auth/Default/creds.json', 'session.json', 'session/token.txt'];

/** File extensions an export archive may legitimately contain. */
const ALLOWED_EXTENSIONS = new Set([
  'html',
  'css',
  'woff2',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'tiff',
]);

async function listFilesRecursively(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    if ((await stat(path)).isDirectory()) {
      out.push(...(await listFilesRecursively(path)));
    } else {
      out.push(path);
    }
  }
  return out;
}

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'chatframe-session-exclusion-'));
  for (const decoy of SESSION_DECOYS) {
    const path = join(projectDir, decoy);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, '{"fake":"session-data"}', 'utf8');
  }
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

describe('export session exclusion (contracts §3)', () => {
  it('produces an archive with zero session artifacts and only allowed file types', async () => {
    const messages = [...mockMessages].sort((a, b) => a.timestampIso.localeCompare(b.timestampIso));
    const model = buildRenderModel(messages, {
      projectId: 'session-exclusion-test',
      chatId: messages[0]?.chatId ?? 'chat-001',
      participants: [
        { id: 'me', displayName: 'You', isMe: true },
        { id: 'contact-001', displayName: 'Contact', isMe: false },
      ],
    });

    const result = await exportHtml({
      projectId: 'session-exclusion-test',
      projectDir,
      settings: {
        showContactName: true,
        showPhoneNumber: false,
        showWatermark: true,
        theme: 'light',
      },
      locale: 'en',
      model,
    });

    const exportRoot = join(projectDir, result.exportDir);
    const files = (await listFilesRecursively(exportRoot)).map((path) =>
      relative(exportRoot, path).replaceAll('\\', '/'),
    );
    expect(files.length).toBeGreaterThan(0);

    // 1. No session artifacts: nothing matching session naming anywhere.
    const sessionLike = files.filter((file) => /wwebjs|session|creds|\.json$/i.test(file));
    expect(sessionLike, `session-like files in export: ${sessionLike.join(', ')}`).toEqual([]);

    // 2. Allow-list: every file is an html/css/font/image asset.
    const disallowed = files.filter((file) => {
      const extension = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
      return !ALLOWED_EXTENSIONS.has(extension);
    });
    expect(disallowed, `disallowed files in export: ${disallowed.join(', ')}`).toEqual([]);

    // 3. The planted decoys still exist in the project (we scanned the right
    // tree) — they just never crossed into the archive.
    await expect(stat(join(projectDir, 'session.json'))).resolves.toBeDefined();
  }, 30_000);
});
