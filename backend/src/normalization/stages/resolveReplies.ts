import type { NormalizedMessage } from '@chatframe/shared';
import type { MappedMessage, NormalizationMetrics } from '../types';

/**
 * Reply resolution (FR-006, FR-007, research §5).
 *
 * Links each message that carries a `replyTo.messageId` to its parent on a
 * best-effort basis. When the parent is present in the import, `resolved` is set
 * to `true`, `previewType` is taken from the parent's type, and `previewText` is
 * a code-point-safe preview of the parent body/caption truncated to 100 code
 * points (with an ellipsis when longer). When the parent is absent, `resolved`
 * stays `false` and the message is counted in `metrics.unresolvedReplies`.
 *
 * Only the immediate parent is linked — reply chains are not walked (edge case).
 */

/** Maximum preview length in Unicode code points (FR-007, clarification). */
const PREVIEW_MAX_CODE_POINTS = 100;

/** Truncates to {@link PREVIEW_MAX_CODE_POINTS} code points, appending `…`. */
function truncatePreview(text: string): string {
  const codePoints = [...text];
  if (codePoints.length <= PREVIEW_MAX_CODE_POINTS) {
    return text;
  }
  return `${codePoints.slice(0, PREVIEW_MAX_CODE_POINTS).join('')}…`;
}

/** Builds a preview string for a resolved parent (body/caption, else a placeholder). */
function previewTextFor(parent: NormalizedMessage): string {
  const source = parent.body ?? parent.image?.caption;
  if (source !== undefined && source.length > 0) {
    return truncatePreview(source);
  }
  switch (parent.type) {
    case 'image':
      return '[image]';
    case 'deleted':
      return '[deleted message]';
    case 'unsupported':
      return '[unsupported message]';
    default:
      return '';
  }
}

/**
 * Resolves reply references in place against the messages present in `items`,
 * updating `metrics.unresolvedReplies`. Returns the same array.
 */
export function resolveReplies(
  items: MappedMessage[],
  metrics: NormalizationMetrics,
): MappedMessage[] {
  const byId = new Map<string, NormalizedMessage>();
  for (const item of items) {
    byId.set(item.message.id, item.message);
  }

  for (const item of items) {
    const replyTo = item.message.replyTo;
    if (!replyTo?.messageId) {
      continue;
    }
    const parent = byId.get(replyTo.messageId);
    if (parent) {
      replyTo.resolved = true;
      replyTo.previewType = parent.type;
      replyTo.previewText = previewTextFor(parent);
    } else {
      replyTo.resolved = false;
      metrics.unresolvedReplies += 1;
    }
  }

  return items;
}
