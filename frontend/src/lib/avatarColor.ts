/**
 * Deterministic generated-avatar descriptor (FR-009, SC-005): a fixed palette
 * color picked by hashing the contact's identity, plus the first grapheme of
 * the display label. Real profile pictures are never used (Constitution XII).
 */

export interface AvatarDescriptor {
  /** Single grapheme shown inside the circle (handles Arabic and emoji). */
  initial: string;
  /** Background color, always one of {@link AVATAR_PALETTE}. */
  color: string;
}

/**
 * Fixed, accessible palette — 700-level tones, all with ≥4.5:1 contrast
 * against the white initial (WCAG AA).
 */
export const AVATAR_PALETTE: readonly string[] = [
  '#b91c1c', // red
  '#c2410c', // orange
  '#a16207', // yellow (dark)
  '#15803d', // green
  '#0f766e', // teal
  '#0369a1', // sky
  '#4338ca', // indigo
  '#7e22ce', // purple
  '#be185d', // pink
  '#334155', // slate
];

/** FNV-1a 32-bit string hash — stable across sessions and platforms. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** First grapheme of a string (so Arabic letters and emoji stay whole). */
function firstGrapheme(value: string): string | null {
  if (value.length === 0) {
    return null;
  }
  if (typeof Intl.Segmenter === 'function') {
    for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
      value,
    )) {
      return segment.segment;
    }
  }
  // Fallback: first code point (still safe for surrogate pairs).
  return [...value][0] ?? null;
}

/**
 * Derives the avatar for a contact. Identical inputs always produce identical
 * output (SC-005). The initial comes from the display name, falling back to
 * the phone number's first digit, then to a placeholder.
 */
export function avatarDescriptor(
  displayName: string | null,
  phoneNumber: string | null,
): AvatarDescriptor {
  const identity = displayName ?? phoneNumber ?? '';
  // Strip the leading '+' so phone-only contacts show a digit, not a sign.
  const label = identity.trim().replace(/^\+/, '');
  const initial = firstGrapheme(label)?.toLocaleUpperCase() ?? '?';
  const color = AVATAR_PALETTE[hashString(identity) % AVATAR_PALETTE.length] ?? '#334155';
  return { initial, color };
}
