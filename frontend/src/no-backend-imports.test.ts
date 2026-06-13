import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Architectural guards (008 SC-009, SC-010; Constitution VII/X/XV).
 *
 * - The frontend must reach data exclusively through `/api/...` endpoints and
 *   never import WhatsApp libraries or backend modules (FR-024).
 * - The chat renderer stylesheet must be vanilla CSS so the Phase 9 HTML
 *   export can reuse it verbatim (FR-005).
 */

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Recursively collects all TypeScript source files under `dir`. */
function collectSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSources(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe('frontend/backend separation (SC-009)', () => {
  it('imports nothing from backend/src/whatsapp or any backend module', () => {
    const offenders: string[] = [];
    const importPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

    for (const file of collectSources(SRC_DIR)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(importPattern)) {
        const specifier = match[1] ?? '';
        if (/backend[/\\]/.test(specifier) || specifier.includes('whatsapp-web.js')) {
          offenders.push(`${file} -> ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('chat-renderer.css portability (SC-010)', () => {
  it('is vanilla CSS with no Tailwind-only constructs', () => {
    const css = readFileSync(join(SRC_DIR, 'styles', 'chat-renderer.css'), 'utf8');

    expect(css).not.toMatch(/@apply\b/);
    expect(css).not.toMatch(/@tailwind\b/);
    expect(css).not.toMatch(/\btheme\(/);
    expect(css).not.toMatch(/@config\b/);
    // Everything is scoped under the .cf- namespace for export reuse.
    expect(css).toMatch(/\.cf-chat\b/);
  });
});
