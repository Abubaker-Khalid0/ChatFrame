import type { MappedMessage } from '../types';

/**
 * Chronological sort (FR-004, determinism research §10).
 *
 * Orders messages ascending by `timestampIso`, breaking ties by the original
 * file index so the result is fully deterministic and stable for equal
 * timestamps (SC-003). Returns a new array; the input is not mutated.
 */
export function sortMessages(items: MappedMessage[]): MappedMessage[] {
  return [...items].sort((a, b) => {
    if (a.message.timestampIso < b.message.timestampIso) return -1;
    if (a.message.timestampIso > b.message.timestampIso) return 1;
    return a.fileIndex - b.fileIndex;
  });
}
