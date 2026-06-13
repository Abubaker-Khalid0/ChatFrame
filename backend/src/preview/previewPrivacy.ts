import {
  applyPrivacyToMessageRow,
  applyPrivacyToParticipants,
  type MessageRow,
  type Participant,
  type PrivacySettings,
} from '@chatframe/shared';

/**
 * Applies the shared privacy transform to a paginated preview slice (FR-004,
 * 008 plan §1). A thin wrapper over the `@chatframe/shared` helpers so the
 * backend and frontend can never drift (research §3); the returned
 * `appliedPrivacy` echo lets the client confirm parity (FR-021).
 */

export interface PrivacyAppliedSlice {
  participants: Participant[];
  messages: MessageRow[];
  /** Echo of the exact settings that were applied. */
  appliedPrivacy: PrivacySettings;
}

/** Transforms participants and message rows in one pass under `settings`. */
export function applyPreviewPrivacy(
  participants: readonly Participant[],
  messages: readonly MessageRow[],
  settings: PrivacySettings,
): PrivacyAppliedSlice {
  return {
    participants: applyPrivacyToParticipants(participants, settings),
    messages: messages.map((row) => applyPrivacyToMessageRow(row, settings)),
    appliedPrivacy: settings,
  };
}
