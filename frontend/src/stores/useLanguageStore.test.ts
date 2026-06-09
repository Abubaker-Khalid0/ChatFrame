import { beforeEach, describe, expect, it } from 'vitest';
import { LANGUAGE_STORAGE_KEY, useLanguageStore } from './useLanguageStore';

function readPersisted(): { language?: unknown; hasChosen?: unknown } | null {
  const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as { state?: { language?: unknown; hasChosen?: unknown } }).state ?? null;
}

describe('useLanguageStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLanguageStore.setState({ language: 'en', direction: 'ltr', hasChosen: false });
  });

  it('defaults to English / LTR and not-yet-chosen', () => {
    const { language, direction, hasChosen } = useLanguageStore.getState();
    expect(language).toBe('en');
    expect(direction).toBe('ltr');
    expect(hasChosen).toBe(false);
  });

  it('setLanguage updates direction and persists the choice', () => {
    useLanguageStore.getState().setLanguage('ar');
    const state = useLanguageStore.getState();
    expect(state.language).toBe('ar');
    expect(state.direction).toBe('rtl');
    expect(readPersisted()?.language).toBe('ar');
  });

  it('confirm marks the language as chosen (persisted)', () => {
    useLanguageStore.getState().confirm();
    expect(useLanguageStore.getState().hasChosen).toBe(true);
    expect(readPersisted()?.hasChosen).toBe(true);
  });

  it('rehydrating an unrecognized stored language falls back to English / LTR', async () => {
    localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      JSON.stringify({ state: { language: 'xx', hasChosen: true }, version: 0 }),
    );
    await useLanguageStore.persist.rehydrate();
    const state = useLanguageStore.getState();
    expect(state.language).toBe('en');
    expect(state.direction).toBe('ltr');
  });
});
