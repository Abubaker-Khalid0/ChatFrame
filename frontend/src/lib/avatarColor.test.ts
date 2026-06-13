import { describe, expect, it } from 'vitest';
import { AVATAR_PALETTE, avatarDescriptor } from './avatarColor';

describe('avatarDescriptor (FR-009, SC-005)', () => {
  it('is deterministic: the same identity always yields the same descriptor', () => {
    const first = avatarDescriptor('Sarah Johnson', '+14155550142');
    const second = avatarDescriptor('Sarah Johnson', '+14155550142');
    expect(second).toEqual(first);
  });

  it('always picks a color from the fixed palette', () => {
    for (const name of ['أحمد محمد', 'Sarah Johnson', 'X', '😀']) {
      const { color } = avatarDescriptor(name, null);
      expect(AVATAR_PALETTE).toContain(color);
    }
  });

  it('extracts the first initial of an English name, uppercased', () => {
    expect(avatarDescriptor('sarah Johnson', null).initial).toBe('S');
  });

  it('extracts the first Arabic grapheme of an Arabic name', () => {
    expect(avatarDescriptor('أحمد محمد', null).initial).toBe('أ');
  });

  it('keeps a multi-code-unit grapheme (emoji) whole', () => {
    expect(avatarDescriptor('😀 Bob', null).initial).toBe('😀');
  });

  it('falls back to the first phone digit when there is no name', () => {
    expect(avatarDescriptor(null, '+966501234567').initial).toBe('9');
  });

  it('falls back to a placeholder when name and phone are both missing', () => {
    expect(avatarDescriptor(null, null).initial).toBe('?');
  });
});
