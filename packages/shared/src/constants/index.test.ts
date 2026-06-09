import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BACKEND_PORT,
  DEFAULT_DIRECTION,
  DEFAULT_FRONTEND_PORT,
  DEFAULT_LANGUAGE,
  DIRECTION_BY_LANGUAGE,
  LANGUAGES,
  isLanguage,
} from './index';

describe('shared constants', () => {
  it('supports exactly English and Arabic', () => {
    expect(LANGUAGES).toEqual(['en', 'ar']);
  });

  it('maps each language to a direction (ar→rtl, en→ltr)', () => {
    expect(DIRECTION_BY_LANGUAGE).toEqual({ en: 'ltr', ar: 'rtl' });
  });

  it('defaults to English / LTR', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(DEFAULT_DIRECTION).toBe('ltr');
  });

  it('exposes the documented default ports', () => {
    expect(DEFAULT_BACKEND_PORT).toBe(3714);
    expect(DEFAULT_FRONTEND_PORT).toBe(5173);
  });

  it('isLanguage guards unknown values', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('ar')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(42)).toBe(false);
  });
});
