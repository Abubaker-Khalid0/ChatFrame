import { describe, expect, it } from 'vitest';
import { ShellOpenFolderRequestSchema, ShellOpenFolderResponseSchema } from './shell';

describe('ShellOpenFolderRequestSchema (009 data-model §1.3)', () => {
  it('round-trips a valid request', () => {
    const request = { projectId: 'chatframe_2026-06-10_friend', path: 'exports/html' };
    expect(ShellOpenFolderRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects an empty projectId or path', () => {
    expect(ShellOpenFolderRequestSchema.safeParse({ projectId: '', path: 'exports' }).success).toBe(
      false,
    );
    expect(ShellOpenFolderRequestSchema.safeParse({ projectId: 'p', path: '' }).success).toBe(
      false,
    );
  });

  it('rejects missing fields', () => {
    expect(ShellOpenFolderRequestSchema.safeParse({ path: 'exports' }).success).toBe(false);
    expect(ShellOpenFolderRequestSchema.safeParse({ projectId: 'p' }).success).toBe(false);
  });
});

describe('ShellOpenFolderResponseSchema (009 data-model §1.3)', () => {
  it('round-trips both opened states', () => {
    expect(ShellOpenFolderResponseSchema.parse({ opened: true })).toEqual({ opened: true });
    expect(ShellOpenFolderResponseSchema.parse({ opened: false })).toEqual({ opened: false });
  });

  it('rejects a non-boolean opened value', () => {
    expect(ShellOpenFolderResponseSchema.safeParse({ opened: 'yes' }).success).toBe(false);
  });
});
