import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * Bundled export fonts (009 research §1, FR-004).
 *
 * The exporter copies a curated set of `.woff2` files from the already-approved
 * `@fontsource/inter` and `@fontsource/ibm-plex-sans-arabic` packages — the
 * same packages the Phase 8 preview uses — into `assets/fonts/`, and generates
 * a matching `assets/fonts.css`. The `@font-face` rules live in a SEPARATE
 * stylesheet so `assets/style.css` stays a byte-identical copy of
 * `chat-renderer.css` (SC-008, research §2). `local()` is intentionally
 * omitted so the bundled file is always authoritative offline.
 */

export interface ExportFontFile {
  /** Filename inside the export's `assets/fonts/` directory. */
  filename: string;
  /** CSS `font-family` name as declared by `chat-renderer.css`. */
  family: string;
  /** Numeric font weight (the renderer uses 400 and 600 only). */
  weight: 400 | 600;
  /** `unicode-range` source subset (informational; full files are bundled). */
  subset: 'latin' | 'latin-ext' | 'arabic';
}

/** The curated weight/subset matrix the chat renderer actually uses. */
export const EXPORT_FONT_FILES: readonly ExportFontFile[] = [
  { filename: 'inter-latin-400-normal.woff2', family: 'Inter', weight: 400, subset: 'latin' },
  { filename: 'inter-latin-600-normal.woff2', family: 'Inter', weight: 600, subset: 'latin' },
  {
    filename: 'inter-latin-ext-400-normal.woff2',
    family: 'Inter',
    weight: 400,
    subset: 'latin-ext',
  },
  {
    filename: 'inter-latin-ext-600-normal.woff2',
    family: 'Inter',
    weight: 600,
    subset: 'latin-ext',
  },
  {
    filename: 'ibm-plex-sans-arabic-arabic-400-normal.woff2',
    family: 'IBM Plex Sans Arabic',
    weight: 400,
    subset: 'arabic',
  },
  {
    filename: 'ibm-plex-sans-arabic-arabic-600-normal.woff2',
    family: 'IBM Plex Sans Arabic',
    weight: 600,
    subset: 'arabic',
  },
];

const require = createRequire(import.meta.url);

/** Maps a font family to the `@fontsource/*` package that ships its files. */
const PACKAGE_BY_FAMILY: Record<string, string> = {
  Inter: '@fontsource/inter',
  'IBM Plex Sans Arabic': '@fontsource/ibm-plex-sans-arabic',
};

/**
 * Resolves the absolute on-disk path of a bundled font file inside its
 * `@fontsource/*` package's `files/` directory.
 */
export function resolveFontFilePath(font: ExportFontFile): string {
  const packageName = PACKAGE_BY_FAMILY[font.family];
  if (packageName === undefined) {
    throw new Error(`No font package registered for family '${font.family}'`);
  }
  const packageRoot = dirname(require.resolve(`${packageName}/package.json`));
  return join(packageRoot, 'files', font.filename);
}

/**
 * Generates the `assets/fonts.css` content: one `@font-face` rule per bundled
 * file, pointing at `./fonts/<file>.woff2` relative URLs only (offline,
 * FR-002/FR-009). `font-display: swap` keeps text visible during load.
 */
export function generateFontsCss(fonts: readonly ExportFontFile[] = EXPORT_FONT_FILES): string {
  const rules = fonts.map(
    (font) =>
      `@font-face {\n` +
      `  font-family: '${font.family}';\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${font.weight};\n` +
      `  font-display: swap;\n` +
      `  src: url('./fonts/${font.filename}') format('woff2');\n` +
      `}`,
  );
  return `${rules.join('\n\n')}\n`;
}
