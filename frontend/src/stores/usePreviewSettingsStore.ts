import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  PREVIEW_FONT_SCALE_MAX,
  PREVIEW_FONT_SCALE_MIN,
  PREVIEW_WIDTH_MAX_PX,
  PREVIEW_WIDTH_MIN_PX,
  PreviewThemeSchema,
  type PreviewTheme,
  type PrivacySettings,
} from '@chatframe/shared';

/** localStorage key for the persisted preview presentation choices. */
export const PREVIEW_SETTINGS_STORAGE_KEY = 'chatframe.preview-settings';

/** Defaults per data-model §2. */
const DEFAULT_THEME: PreviewTheme = 'light';
const DEFAULT_FONT_SCALE = 1.0;
const DEFAULT_WIDTH_PX = 420;
const DEFAULT_PRIVACY: PrivacySettings = { showContactName: true, showPhoneNumber: false };

/** Clamps a number into `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface PreviewSettingsState {
  /** Chat renderer theme; drives `data-theme` and seeds the export default (US3 AC-3). */
  theme: PreviewTheme;
  /** Font-scale multiplier bound to `--cf-font-scale` (FR-018). */
  fontScale: number;
  /** Conversation panel width bound to `--cf-conversation-width` (FR-019). */
  widthPx: number;
  /** Real-time privacy settings applied client-side over cached pages (FR-021). */
  privacy: PrivacySettings;
  /** Last scroll offset of the conversation, restored on re-entry (FR-029). */
  scrollOffset: number;
  /** Watermark toggle for the export settings screen (009 FR-008, default on). */
  showWatermark: boolean;
  setTheme: (theme: PreviewTheme) => void;
  setFontScale: (fontScale: number) => void;
  setWidthPx: (widthPx: number) => void;
  setPrivacy: (privacy: PrivacySettings) => void;
  setScrollOffset: (scrollOffset: number) => void;
  setShowWatermark: (showWatermark: boolean) => void;
}

/**
 * Preview presentation state (008 plan §3): theme, font scale, panel width,
 * privacy toggles, and the saved scroll offset. Only the theme is persisted —
 * it seeds the export default (US3 AC-3); everything else is session state.
 */
export const usePreviewSettingsStore = create<PreviewSettingsState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      fontScale: DEFAULT_FONT_SCALE,
      widthPx: DEFAULT_WIDTH_PX,
      privacy: DEFAULT_PRIVACY,
      scrollOffset: 0,
      showWatermark: true,
      setTheme: (theme) => set({ theme }),
      setFontScale: (fontScale) =>
        set({ fontScale: clamp(fontScale, PREVIEW_FONT_SCALE_MIN, PREVIEW_FONT_SCALE_MAX) }),
      setWidthPx: (widthPx) =>
        set({ widthPx: Math.round(clamp(widthPx, PREVIEW_WIDTH_MIN_PX, PREVIEW_WIDTH_MAX_PX)) }),
      setPrivacy: (privacy) => set({ privacy }),
      setScrollOffset: (scrollOffset) => set({ scrollOffset }),
      setShowWatermark: (showWatermark) => set({ showWatermark }),
    }),
    {
      name: PREVIEW_SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist only the theme; it pre-populates the export settings default.
      partialize: (state) => ({ theme: state.theme }),
      // Sanitize persisted values: unrecognized theme → default.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Pick<PreviewSettingsState, 'theme'>>;
        const parsed = PreviewThemeSchema.safeParse(stored.theme);
        return { ...current, theme: parsed.success ? parsed.data : DEFAULT_THEME };
      },
    },
  ),
);
