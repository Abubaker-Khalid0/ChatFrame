import { describe, expect, it } from 'vitest';
import { directionForLanguage } from './direction';

describe('directionForLanguage', () => {
  it('maps Arabic to rtl', () => {
    expect(directionForLanguage('ar')).toBe('rtl');
  });

  it('maps English to ltr', () => {
    expect(directionForLanguage('en')).toBe('ltr');
  });

  it('falls back to ltr for an unrecognized language', () => {
    expect(directionForLanguage('fr')).toBe('ltr');
    expect(directionForLanguage('')).toBe('ltr');
  });
});
