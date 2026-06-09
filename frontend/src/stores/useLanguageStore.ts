import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_DIRECTION,
  DEFAULT_LANGUAGE,
  DIRECTION_BY_LANGUAGE,
  isLanguage,
  type Direction,
  type Language,
} from '@chatframe/shared';

/** localStorage key for the persisted language preference. */
export const LANGUAGE_STORAGE_KEY = 'chatframe.language';

interface LanguageState {
  /** Selected interface language. */
  language: Language;
  /** Derived layout direction (always consistent with `language`). */
  direction: Direction;
  /** Whether the user has explicitly chosen a language (gates the welcome screen). */
  hasChosen: boolean;
  /** Change language + direction immediately (used by the switcher and welcome). */
  setLanguage: (language: Language) => void;
  /** Mark the language as explicitly chosen (welcome "Continue"). */
  confirm: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      direction: DEFAULT_DIRECTION,
      hasChosen: false,
      setLanguage: (language) => set({ language, direction: DIRECTION_BY_LANGUAGE[language] }),
      confirm: () => set({ hasChosen: true }),
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist only the user's intent; direction is always derived.
      partialize: (state) => ({ language: state.language, hasChosen: state.hasChosen }),
      // Sanitize persisted values: unrecognized language → default (Edge Cases).
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Pick<LanguageState, 'language' | 'hasChosen'>>;
        const language = isLanguage(stored.language) ? stored.language : DEFAULT_LANGUAGE;
        return {
          ...current,
          language,
          direction: DIRECTION_BY_LANGUAGE[language],
          hasChosen: typeof stored.hasChosen === 'boolean' ? stored.hasChosen : false,
        };
      },
    },
  ),
);
