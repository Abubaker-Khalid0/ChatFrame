import type { MappedMessage, NormalizationMetrics } from '../types';

/**
 * Unsupported-type preservation (FR-009, Constitution XXIII — no silent data
 * loss).
 *
 * `mapMessage` has already assigned `type: 'unsupported'` to any message whose
 * raw type is not text/image/deleted. This stage attaches the human-readable
 * `unsupported` metadata (original type + reason) and tallies each original
 * type into the metrics accumulator. Messages are mutated in place and the same
 * array is returned. Nothing is dropped — unsupported messages remain fully
 * present in the output.
 */
export function classifyUnsupported(
  items: MappedMessage[],
  metrics: NormalizationMetrics,
): MappedMessage[] {
  for (const item of items) {
    if (item.message.type !== 'unsupported') {
      continue;
    }
    const originalType = item.rawType.length > 0 ? item.rawType : 'unknown';
    item.message.unsupported = {
      originalType,
      reason: `Unsupported message type: ${originalType}`,
    };
    metrics.unsupportedMessageTypes[originalType] =
      (metrics.unsupportedMessageTypes[originalType] ?? 0) + 1;
  }
  return items;
}
