import { stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { EXPORT_FONT_FILES, generateFontsCss, resolveFontFilePath } from './fontAssets';

describe('EXPORT_FONT_FILES (research §1)', () => {
  it('covers Inter latin + latin-ext and IBM Plex Sans Arabic arabic, weights 400 + 600', () => {
    const byFamily = new Map<string, Set<number>>();
    for (const font of EXPORT_FONT_FILES) {
      const weights = byFamily.get(font.family) ?? new Set<number>();
      weights.add(font.weight);
      byFamily.set(font.family, weights);
    }
    expect([...byFamily.keys()].sort()).toEqual(['IBM Plex Sans Arabic', 'Inter']);
    expect([...(byFamily.get('Inter') ?? [])].sort()).toEqual([400, 600]);
    expect([...(byFamily.get('IBM Plex Sans Arabic') ?? [])].sort()).toEqual([400, 600]);
  });

  it('every listed font file resolves to an existing .woff2 on disk', async () => {
    for (const font of EXPORT_FONT_FILES) {
      const path = resolveFontFilePath(font);
      expect(path.endsWith('.woff2')).toBe(true);
      const info = await stat(path);
      expect(info.isFile()).toBe(true);
      expect(info.size).toBeGreaterThan(0);
    }
  });
});

describe('generateFontsCss (research §1)', () => {
  const css = generateFontsCss();

  it('declares @font-face for both families', () => {
    expect(css).toContain(`font-family: 'Inter';`);
    expect(css).toContain(`font-family: 'IBM Plex Sans Arabic';`);
    expect(css.match(/@font-face/g)).toHaveLength(EXPORT_FONT_FILES.length);
  });

  it('uses font-display: swap on every rule', () => {
    expect(css.match(/font-display: swap;/g)).toHaveLength(EXPORT_FONT_FILES.length);
  });

  it('references only relative ./fonts/*.woff2 URLs — no remote URLs', () => {
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(urls).toHaveLength(EXPORT_FONT_FILES.length);
    for (const url of urls) {
      expect(url).toMatch(/^\.\/fonts\/[a-z0-9-]+\.woff2$/);
    }
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('declares both 400 and 600 weights', () => {
    expect(css).toContain('font-weight: 400;');
    expect(css).toContain('font-weight: 600;');
  });
});
