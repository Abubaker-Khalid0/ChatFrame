import type { Participant } from './participant';
import type { MessageRow } from './render';
import type { PrivacySettings } from './view-settings';

/**
 * Pure presentational privacy transform shared by the backend (FR-004, export
 * fidelity) and the frontend (FR-021, instant toggles) — a single source of
 * truth so the live preview is guaranteed to equal the exported result
 * (008 data-model §3, research §3).
 *
 * Invariants: never mutates message content (`body`, captions, reply preview
 * text); never alters the local user; output is a function of inputs only
 * (no clock, no I/O).
 */

/**
 * Stable placeholder token returned when the contact name is hidden. The
 * caller localizes it (e.g. to "Contact" / "جهة اتصال") at render time, so
 * backend and frontend agree on one neutral value (data-model §3).
 */
export const PRIVACY_NAME_PLACEHOLDER = '__contact__';

/**
 * Resolves the display name to show for a participant under `settings`.
 * The local user is never altered; an alias takes precedence over the hide
 * toggle; a hidden name becomes {@link PRIVACY_NAME_PLACEHOLDER}.
 */
export function displayNameFor(
  originalName: string,
  isMe: boolean,
  settings: PrivacySettings,
): string {
  if (isMe) {
    return originalName;
  }
  const alias = settings.displayAlias?.trim();
  if (alias !== undefined && alias.length > 0) {
    return alias;
  }
  if (!settings.showContactName) {
    return PRIVACY_NAME_PLACEHOLDER;
  }
  return originalName;
}

/** Returns the phone number when `showPhoneNumber` is on, else `undefined`. */
export function phoneNumberFor(
  originalPhone: string | undefined,
  settings: PrivacySettings,
): string | undefined {
  return settings.showPhoneNumber ? originalPhone : undefined;
}

/** Applies {@link displayNameFor} to every participant in one pass. */
export function applyPrivacyToParticipants(
  participants: readonly Participant[],
  settings: PrivacySettings,
): Participant[] {
  return participants.map((participant) => ({
    ...participant,
    displayName: displayNameFor(participant.displayName, participant.isMe, settings),
  }));
}

/**
 * Applies the privacy transform to a single render row. Only the sender's
 * display name of received messages is affected; sent rows (the local user)
 * and message content are returned unchanged.
 */
export function applyPrivacyToMessageRow(row: MessageRow, settings: PrivacySettings): MessageRow {
  if (row.senderDisplayName === undefined) {
    return row;
  }
  const isMe = row.direction === 'sent';
  const displayName = displayNameFor(row.senderDisplayName, isMe, settings);
  if (displayName === row.senderDisplayName) {
    return row;
  }
  return { ...row, senderDisplayName: displayName };
}
