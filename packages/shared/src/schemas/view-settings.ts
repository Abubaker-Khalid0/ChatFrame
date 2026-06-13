import { z } from 'zod';

/**
 * Shared preview presentation settings (008 data-model §2). These are the
 * presentation choices made in the preview toolbar; the selected values seed
 * the export defaults (US3 AC-3, Constitution XII). They are held in frontend
 * state and not persisted by the preview feature.
 */

/** Preview theme — same values as `ExportThemeSchema` so the previewed theme seeds the export default. */
export const PreviewThemeSchema = z.enum(['light', 'dark']);
export type PreviewTheme = z.infer<typeof PreviewThemeSchema>;

/**
 * Privacy presentation settings (FR-004, FR-021). Field-compatible with the
 * privacy subset of `ExportSettings` so the chosen privacy flows straight into
 * export with no remapping.
 */
export const PrivacySettingsSchema = z.object({
  /** When false (and no alias), the contact's name is replaced with a neutral label. */
  showContactName: z.boolean().default(true),
  /** When present, replaces the contact's display name everywhere; takes precedence over `showContactName`. */
  displayAlias: z.string().trim().min(1).optional(),
  /** Controls phone-number visibility in the conversation header only. */
  showPhoneNumber: z.boolean().default(false),
});
export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;

/** Bounds for the preview font-scale multiplier (FR-018). */
export const PREVIEW_FONT_SCALE_MIN = 0.8;
export const PREVIEW_FONT_SCALE_MAX = 1.6;

/** Bounds for the conversation panel width in pixels (FR-019). */
export const PREVIEW_WIDTH_MIN_PX = 320;
export const PREVIEW_WIDTH_MAX_PX = 720;

/** View settings driving the chat renderer (theme, font scale, panel width). */
export const PreviewViewSettingsSchema = z.object({
  /** Drives `data-theme` on the chat root (FR-017). */
  theme: PreviewThemeSchema.default('light'),
  /** Multiplier bound to `--cf-font-scale` (FR-018). */
  fontScale: z.number().min(PREVIEW_FONT_SCALE_MIN).max(PREVIEW_FONT_SCALE_MAX).default(1.0),
  /** Phone-panel width bound to `--cf-conversation-width` (FR-019). */
  widthPx: z.number().int().min(PREVIEW_WIDTH_MIN_PX).max(PREVIEW_WIDTH_MAX_PX).default(420),
});
export type PreviewViewSettings = z.infer<typeof PreviewViewSettingsSchema>;
