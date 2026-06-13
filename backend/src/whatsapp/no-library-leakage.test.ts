import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static import-analysis guard (FR-002, SC-008): `whatsapp-web.js` may only be
 * imported inside `backend/src/whatsapp/`. Any import elsewhere — backend,
 * frontend, or shared — means library types are leaking past the adapter
 * boundary (Constitution IV).
 */

const HERE = dirname(fileURLToPath(import.meta.url)); // backend/src/whatsapp
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const ALLOWED_DIR = resolve(REPO_ROOT, 'backend', 'src', 'whatsapp');

/** Source trees that must stay free of direct library imports. */
const SCANNED_DIRS = [
  resolve(REPO_ROOT, 'backend', 'src'),
  resolve(REPO_ROOT, 'frontend', 'src'),
  resolve(REPO_ROOT, 'packages', 'shared', 'src'),
];

/** Matches static imports, dynamic imports, and requires of the library. */
const LIBRARY_IMPORT = /(?:from\s+|require\(\s*|import\(\s*)['"]whatsapp-web\.js['"]/;

async function listSourceFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(full)));
    } else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function isInsideAllowedDir(file: string): boolean {
  const rel = relative(ALLOWED_DIR, file);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep);
}

describe('whatsapp-web.js containment (SC-008)', () => {
  it('has no whatsapp-web.js imports outside backend/src/whatsapp/', async () => {
    const offenders: string[] = [];

    for (const dir of SCANNED_DIRS) {
      for (const file of await listSourceFiles(dir)) {
        if (isInsideAllowedDir(file)) continue;
        const contents = await readFile(file, 'utf8');
        if (LIBRARY_IMPORT.test(contents)) {
          offenders.push(relative(REPO_ROOT, file));
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the real adapter inside the allowed directory (sanity check)', async () => {
    // Guard against the guard: the adapter itself must import the library, so
    // an empty scan result above cannot come from a broken regex or paths.
    const adapter = await readFile(join(ALLOWED_DIR, 'WhatsappWebJsAdapter.ts'), 'utf8');
    expect(LIBRARY_IMPORT.test(adapter)).toBe(true);
  });
});
