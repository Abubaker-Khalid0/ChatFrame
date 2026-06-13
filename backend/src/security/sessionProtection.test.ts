import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertSessionDirEmpty,
  assertSessionDirIsolated,
  isSessionPath,
  listFilesRecursively,
  pathsOverlap,
} from './sessionProtection';

let base: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'chatframe-sessprot-'));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('pathsOverlap', () => {
  it('detects a child inside a parent (both directions)', () => {
    expect(pathsOverlap(join(base, 'a'), join(base, 'a', 'b'))).toBe(true);
    expect(pathsOverlap(join(base, 'a', 'b'), join(base, 'a'))).toBe(true);
  });

  it('treats identical paths as overlapping', () => {
    expect(pathsOverlap(join(base, 'a'), join(base, 'a'))).toBe(true);
  });

  it('reports disjoint siblings as non-overlapping', () => {
    expect(pathsOverlap(join(base, 'sessions'), join(base, 'projects'))).toBe(false);
  });

  it('is not fooled by common name prefixes', () => {
    expect(pathsOverlap(join(base, 'sessions'), join(base, 'sessions-other'))).toBe(false);
  });
});

describe('assertSessionDirIsolated (FR-019)', () => {
  it('passes for disjoint session and projects directories', () => {
    expect(() =>
      assertSessionDirIsolated(join(base, 'sessions'), join(base, 'projects')),
    ).not.toThrow();
  });

  it('throws when the session dir is inside the projects dir', () => {
    expect(() =>
      assertSessionDirIsolated(join(base, 'projects', 'sessions'), join(base, 'projects')),
    ).toThrow(/must not overlap/);
  });

  it('throws when the projects dir is inside the session dir', () => {
    expect(() =>
      assertSessionDirIsolated(join(base, 'data'), join(base, 'data', 'projects')),
    ).toThrow(/must not overlap/);
  });
});

describe('isSessionPath', () => {
  it('flags paths under the session dir and accepts outside paths', () => {
    const sessions = join(base, 'sessions');
    expect(isSessionPath(join(sessions, 'whatsapp-web-js', 'Default', 'Cookies'), sessions)).toBe(
      true,
    );
    expect(isSessionPath(join(base, 'projects', 'p1', 'raw.ndjson'), sessions)).toBe(false);
  });
});

describe('assertSessionDirEmpty (SC-004)', () => {
  it('passes for a missing directory', async () => {
    await expect(assertSessionDirEmpty(join(base, 'nope'))).resolves.toBeUndefined();
  });

  it('passes for a directory tree with no files', async () => {
    const dir = join(base, 'sessions', 'whatsapp-web-js');
    await mkdir(dir, { recursive: true });
    await expect(assertSessionDirEmpty(join(base, 'sessions'))).resolves.toBeUndefined();
  });

  it('throws when any file remains (even deeply nested)', async () => {
    const dir = join(base, 'sessions', 'whatsapp-web-js', 'Default');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'Cookies'), 'secret', 'utf8');
    await expect(assertSessionDirEmpty(join(base, 'sessions'))).rejects.toThrow(
      /cleanup incomplete/,
    );
  });

  it('lists nested files recursively', async () => {
    const dir = join(base, 'tree', 'a', 'b');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'one.txt'), '1', 'utf8');
    await writeFile(join(base, 'tree', 'two.txt'), '2', 'utf8');
    const files = await listFilesRecursively(join(base, 'tree'));
    expect(files).toHaveLength(2);
  });
});
