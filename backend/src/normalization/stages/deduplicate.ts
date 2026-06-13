import type { NormalizedMessage } from '@chatframe/shared';
import type { MappedMessage, NormalizationMetrics } from '../types';

/**
 * Deduplication (FR-005, research §4, clarification).
 *
 * Collapses records that share a message `id` to the single most-complete one.
 * "Completeness" is the count of non-null / non-undefined fields on the mapped
 * `NormalizedMessage` (a present nested object counts as one field). The record
 * with the higher count wins; on a tie the record appearing **later** in the
 * raw file wins (higher `fileIndex`). The result preserves the input order
 * (the pipeline sorts before calling this), keeping exactly one record per id.
 */

/** Counts non-null / non-undefined own fields of a normalized message. */
function completeness(message: NormalizedMessage): number {
  return Object.values(message).filter((value) => value !== null && value !== undefined).length;
}

/** Returns true when `candidate` should beat `incumbent` for the same id. */
function isMoreComplete(candidate: MappedMessage, incumbent: MappedMessage): boolean {
  const candidateScore = completeness(candidate.message);
  const incumbentScore = completeness(incumbent.message);
  if (candidateScore !== incumbentScore) {
    return candidateScore > incumbentScore;
  }
  // Tie → prefer the record later in the raw file (higher fileIndex).
  return candidate.fileIndex > incumbent.fileIndex;
}

/**
 * Removes duplicate-id records, keeping the most complete one, and adds the
 * number removed to `metrics.duplicatesRemoved`. `fileIndex` is unique per raw
 * record, so it identifies the exact winning record when filtering.
 */
export function deduplicate(
  items: MappedMessage[],
  metrics: NormalizationMetrics,
): MappedMessage[] {
  const winners = new Map<string, MappedMessage>();
  for (const item of items) {
    const incumbent = winners.get(item.message.id);
    if (!incumbent || isMoreComplete(item, incumbent)) {
      winners.set(item.message.id, item);
    }
  }

  const result = items.filter((item) => winners.get(item.message.id)?.fileIndex === item.fileIndex);
  metrics.duplicatesRemoved += items.length - result.length;
  return result;
}
