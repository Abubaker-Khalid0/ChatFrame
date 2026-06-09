/**
 * Shared, framework-agnostic constants used by both the backend and frontend.
 * Keeping these in @chatframe/shared prevents divergence (FR-012).
 */

/** Supported interface languages for this phase (Constitution XVI). */
export const LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Layout direction. */
export type Direction = 'ltr' | 'rtl';

/** Canonical language → direction mapping (Arabic RTL, English LTR). */
export const DIRECTION_BY_LANGUAGE: Record<Language, Direction> = {
  en: 'ltr',
  ar: 'rtl',
};

/** Default language/direction when none is stored or a stored value is invalid. */
export const DEFAULT_LANGUAGE: Language = 'en';
export const DEFAULT_DIRECTION: Direction = 'ltr';

/** Default local service ports (configurable via .env, FR-009). */
export const DEFAULT_BACKEND_PORT = 3714;
export const DEFAULT_FRONTEND_PORT = 5173;

/** Type guard: is the given value a supported language code? */
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
