import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Dashboard chrome theme — independent of the conversation preview theme. */
export type DashboardTheme = 'light' | 'dark';

/** localStorage key for the persisted theme preference. */
export const THEME_STORAGE_KEY = 'chatframe.theme';

interface ThemeState {
  /** Current dashboard chrome theme. */
  theme: DashboardTheme;
  /** Toggle between light and dark. */
  toggle: () => void;
  /** Set an explicit theme value. */
  setTheme: (theme: DashboardTheme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggle: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Pick<ThemeState, 'theme'>>;
        const theme = stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : 'light';
        return { ...current, theme };
      },
    },
  ),
);
