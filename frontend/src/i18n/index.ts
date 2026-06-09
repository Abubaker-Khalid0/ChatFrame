import type { Language } from '@chatframe/shared';
import { useLanguageStore } from '../stores/useLanguageStore';
import { ar } from './ar';
import { en, type Dictionary } from './en';

const dictionaries: Record<Language, Dictionary> = { en, ar };

/** Returns the string dictionary for a given language. */
export function getDictionary(language: Language): Dictionary {
  return dictionaries[language];
}

/** Hook: the active dictionary based on the current language selection. */
export function useTranslations(): Dictionary {
  const language = useLanguageStore((s) => s.language);
  return getDictionary(language);
}

export type { Dictionary };
