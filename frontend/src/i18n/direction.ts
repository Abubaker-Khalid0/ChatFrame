import {
  DEFAULT_DIRECTION,
  DIRECTION_BY_LANGUAGE,
  isLanguage,
  type Direction,
} from '@chatframe/shared';

/**
 * Maps a language code to its layout direction. Unrecognized values fall back
 * to the default direction (LTR) rather than rendering a broken layout
 * (Constitution XVI; spec Edge Cases).
 */
export function directionForLanguage(language: string): Direction {
  return isLanguage(language) ? DIRECTION_BY_LANGUAGE[language] : DEFAULT_DIRECTION;
}
