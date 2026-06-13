/**
 * One-off quickstart validation runner (009 T048). Builds the app in mock
 * mode, triggers a real export, and statically verifies the promoted archive
 * against SC-002/003/006/008. Run: `pnpm tsx scripts/validate-export.ts`.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

process.env.MOCK_MODE = 'true';

const { buildApp } = await import('../src/app');
const { PROJECTS_DIR } = await import('../src/config/paths');

const app = buildApp();
await app.ready();

const projectId = 'mock-project';
const res = await app.inject({
  method: 'POST',
  url: `/api/projects/${projectId}/export/html`,
  payload: {
    settings: {
      showContactName: false,
      showPhoneNumber: false,
      displayAlias: 'Friend',
      showWatermark: true,
      theme: 'dark',
    },
    locale: 'en',
  },
});
console.log('POST /export/html →', res.statusCode, res.body);
if (res.statusCode !== 200) {
  process.exit(1);
}

const exportDir = join(PROJECTS_DIR, projectId, 'exports', 'html');
const html = await readFile(join(exportDir, 'conversation.html'), 'utf8');

const checks: [string, boolean][] = [];

// SC-002: relative asset paths only, no remote URLs.
checks.push(['SC-002 no remote src/href', !/(?:src|href)="https?:\/\//.test(html)]);
checks.push([
  'SC-002 relative media src',
  !html.includes('<img') || html.includes('src="assets/media/'),
]);

// SC-003: fonts bundled + fonts.css references them relatively.
const fontsCss = await readFile(join(exportDir, 'assets', 'fonts.css'), 'utf8');
const fontFiles = await readdir(join(exportDir, 'assets', 'fonts'));
checks.push([
  'SC-003 woff2 bundled',
  fontFiles.length === 6 && fontFiles.every((f) => f.endsWith('.woff2')),
]);
checks.push([
  'SC-003 fonts.css relative only',
  /url\('\.\/fonts\//.test(fontsCss) && !/https?:\/\//.test(fontsCss),
]);

// SC-004: watermark present (enabled in this request).
checks.push(['SC-004 watermark present', html.includes('Exported by ChatFrame')]);

// SC-005: privacy — alias applied, no real name.
checks.push(['SC-005 alias applied', html.includes('Friend')]);

// SC-006: tree contains only html/css/woff2/images; no json/ndjson/session bytes.
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    out.push(...(entry.isDirectory() ? await walk(p) : [p]));
  }
  return out;
}
const allowed = new Set(['.html', '.css', '.woff2', '.jpg', '.jpeg', '.png', '.gif', '.webp']);
const files = await walk(exportDir);
checks.push([
  'SC-006 allow-listed files only',
  files.every((f) => allowed.has(extname(f.toLowerCase()))),
]);
checks.push([
  'SC-006 no session/qr/token names',
  files.every((f) => !/session|wwebjs|token|qr/i.test(f.slice(exportDir.length))),
]);

// SC-008: style.css byte-identical to chat-renderer.css.
const source = await readFile(
  new URL('../../frontend/src/styles/chat-renderer.css', import.meta.url),
);
const copied = await readFile(join(exportDir, 'assets', 'style.css'));
checks.push(['SC-008 css byte-identical', copied.equals(source)]);

// SC-009: dark theme attribute emitted.
checks.push(['SC-009 data-theme=dark', html.includes('data-theme="dark"')]);

// FR-002: no script tags.
checks.push(['FR-002 no <script>', !html.includes('<script')]);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed += 1;
}
console.log(
  `\nExport size: ${(await stat(join(exportDir, 'conversation.html'))).size} bytes html, ${files.length} files total`,
);
await app.close();
process.exit(failed === 0 ? 0 : 1);
