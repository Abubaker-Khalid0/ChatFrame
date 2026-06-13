import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_FOLDER_NAME_LENGTH,
  buildFolderName,
  checkPathLength,
  dedupeFolderName,
  exportAssetsDir,
  exportHtmlDir,
  exportHtmlFilePath,
  exportStagingDir,
  slugify,
} from './ProjectPaths';

const DATE = '2026-06-10';

describe('slugify (FR-019)', () => {
  it('preserves Arabic/Unicode characters', () => {
    expect(slugify('أحمد')).toBe('أحمد');
    expect(slugify('محمد علي')).toBe('محمد علي');
  });

  it('preserves a mix of Arabic and Latin', () => {
    expect(slugify('Ahmed أحمد')).toBe('Ahmed أحمد');
  });

  it('strips the nine forbidden filename characters', () => {
    expect(slugify('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('strips ASCII control characters', () => {
    expect(slugify('a\u0000b\u001fc')).toBe('abc');
  });

  it('collapses whitespace and trims trailing dots/spaces', () => {
    expect(slugify('  hello   world  ')).toBe('hello world');
    expect(slugify('name...')).toBe('name');
  });

  it('falls back to "chat" when nothing usable remains', () => {
    expect(slugify('////')).toBe('chat');
    expect(slugify('   ')).toBe('chat');
  });
});

describe('buildFolderName (FR-020)', () => {
  it('builds the deterministic chatframe_<date>_<slug> name', () => {
    expect(buildFolderName(DATE, 'أحمد')).toBe('chatframe_2026-06-10_أحمد');
  });

  it('keeps the folder name within 80 code points even for long input', () => {
    const longName = 'x'.repeat(200);
    const folder = buildFolderName(DATE, longName);
    expect([...folder].length).toBeLessThanOrEqual(MAX_FOLDER_NAME_LENGTH);
  });

  it('does not split multi-byte characters when truncating', () => {
    const longArabic = 'أ'.repeat(200);
    const folder = buildFolderName(DATE, longArabic);
    expect([...folder].length).toBeLessThanOrEqual(MAX_FOLDER_NAME_LENGTH);
    // Every slug character should still be the intact Arabic letter.
    const slug = folder.replace('chatframe_2026-06-10_', '');
    expect([...slug].every((ch) => ch === 'أ')).toBe(true);
  });
});

describe('dedupeFolderName (FR-014)', () => {
  it('returns the desired name when it is free', () => {
    expect(dedupeFolderName('chatframe_2026-06-10_ahmed', [])).toBe('chatframe_2026-06-10_ahmed');
  });

  it('appends -2 on the first collision', () => {
    expect(dedupeFolderName('proj', ['proj'])).toBe('proj-2');
  });

  it('appends -3 when -2 is also taken', () => {
    expect(dedupeFolderName('proj', ['proj', 'proj-2'])).toBe('proj-3');
  });
});

describe('checkPathLength (FR-021)', () => {
  it('returns null for a short path', () => {
    expect(checkPathLength('C:\\data\\projects\\chatframe_2026-06-10_ahmed')).toBeNull();
  });

  it('returns a PATH_LENGTH_WARNING past the threshold', () => {
    const longBase = `C:\\${'deep\\'.repeat(60)}project`;
    const warning = checkPathLength(longBase);
    expect(warning).not.toBeNull();
    expect(warning?.code).toBe('PATH_LENGTH_WARNING');
  });
});

describe('export path helpers (009 data-model §4)', () => {
  const projectDir = join('C:', 'data', 'projects', 'chatframe_2026-06-10_ahmed');

  it('exportHtmlDir points at exports/html', () => {
    expect(exportHtmlDir(projectDir)).toBe(join(projectDir, 'exports', 'html'));
  });

  it('exportAssetsDir points at exports/html/assets', () => {
    expect(exportAssetsDir(projectDir)).toBe(join(projectDir, 'exports', 'html', 'assets'));
  });

  it('exportHtmlFilePath points at exports/html/conversation.html', () => {
    expect(exportHtmlFilePath(projectDir)).toBe(
      join(projectDir, 'exports', 'html', 'conversation.html'),
    );
  });

  it('exportStagingDir builds the per-run staging path under exports/', () => {
    expect(exportStagingDir(projectDir, 'run-42')).toBe(
      join(projectDir, 'exports', 'html.tmp-run-42'),
    );
  });

  it('staging directory is a sibling of the promoted export (same volume rename)', () => {
    const staging = exportStagingDir(projectDir, 'r');
    const promoted = exportHtmlDir(projectDir);
    expect(join(staging, '..')).toBe(join(promoted, '..'));
  });
});
