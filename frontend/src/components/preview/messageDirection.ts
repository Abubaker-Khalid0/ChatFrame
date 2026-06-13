/**
 * Per-message BiDi direction resolution (008 FR-022, research §5,
 * Constitution XVI). Direction is decided per message from its strong
 * characters — never via global overrides:
 *
 * - only RTL strong characters → `rtl`
 * - only LTR strong characters → `ltr`
 * - both (mixed content)       → `auto` (browser resolves from the first
 *                                 strong character, the WhatsApp behavior)
 * - no strong characters       → digits render `ltr`; emoji/punctuation-only
 *                                 fall back to `auto`
 */

export type MessageDir = 'rtl' | 'ltr' | 'auto';

/**
 * Strong RTL scripts: Hebrew through Arabic Extended-A (one contiguous block
 * that also covers Syriac, Thaana, NKo, Samaritan, and Mandaic) plus the
 * Hebrew and Arabic presentation forms.
 */
const RTL_PATTERN = new RegExp('[\\u0590-\\u08FF\\uFB1D-\\uFDFF\\uFE70-\\uFEFF]', 'u');

/** Strong LTR letters: Latin (incl. extensions), Greek, Cyrillic. */
const LTR_PATTERN = new RegExp(
  '[A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF\\u1E00-\\u1EFF]',
  'u',
);

/** Resolves the `dir` attribute for a message text container. */
export function messageDirection(text: string | undefined): MessageDir {
  if (text === undefined || text.length === 0) {
    return 'auto';
  }
  const hasRtl = RTL_PATTERN.test(text);
  const hasLtr = LTR_PATTERN.test(text);
  if (hasRtl && hasLtr) {
    return 'auto';
  }
  if (hasRtl) {
    return 'rtl';
  }
  if (hasLtr) {
    return 'ltr';
  }
  // No strong characters: bare numbers read left-to-right; emoji-only and
  // punctuation-only content lets the browser decide.
  if (/[0-9]/u.test(text)) {
    return 'ltr';
  }
  return 'auto';
}
