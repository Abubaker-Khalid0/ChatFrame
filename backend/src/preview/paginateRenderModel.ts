import type { MessageRow, RenderModel } from '@chatframe/shared';

/**
 * Pagination over the render model's message rows (008 plan §1, research §2).
 *
 * The render model interleaves `date-separator` and `message` entries; the
 * paginated preview endpoint serves message rows only, each enriched with its
 * `dateKey` so the client derives separators on `dateKey` change (FR-009).
 * Offsets therefore index message rows, never separators, keeping page
 * arithmetic trivial and `totalRows` equal to the count endpoint (FR-002).
 */

export interface PaginatedSlice {
  /** The slice `[offset, offset + limit)` of message rows, `dateKey`-enriched. */
  messages: MessageRow[];
  /** Total message rows in the model (stable across pages). */
  totalRows: number;
}

/** Fallback `dateKey` derivation when a row precedes any separator (UTC day). */
function dateKeyFromTimestamp(timestampIso: string): string {
  return timestampIso.slice(0, 10);
}

/**
 * Filters the model to message rows, enriches each with `dateKey` (from the
 * preceding `date-separator` entry — the builder's own value — falling back to
 * the UTC day of `timestampIso`), and returns the `[offset, offset + limit)`
 * slice with the total row count. An offset past the end yields an empty slice.
 */
export function paginateRenderModel(
  model: RenderModel,
  offset: number,
  limit: number,
): PaginatedSlice {
  const rows: MessageRow[] = [];
  let currentDateKey: string | null = null;

  for (const entry of model.entries) {
    if (entry.kind === 'date-separator') {
      currentDateKey = entry.dateKey;
      continue;
    }
    rows.push(
      entry.dateKey !== undefined
        ? entry
        : { ...entry, dateKey: currentDateKey ?? dateKeyFromTimestamp(entry.timestampIso) },
    );
  }

  return {
    messages: rows.slice(offset, offset + limit),
    totalRows: rows.length,
  };
}
