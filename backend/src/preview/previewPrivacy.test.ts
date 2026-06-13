import { describe, expect, it } from 'vitest';
import {
  PRIVACY_NAME_PLACEHOLDER,
  type MessageRow,
  type Participant,
  type PrivacySettings,
} from '@chatframe/shared';
import { applyPreviewPrivacy } from './previewPrivacy';

const participants: Participant[] = [
  { id: 'me', displayName: 'You', isMe: true },
  { id: 'contact-001', displayName: 'أحمد محمد', isMe: false },
];

const messages: MessageRow[] = [
  {
    kind: 'message',
    id: 'm-1',
    senderId: 'contact-001',
    senderDisplayName: 'أحمد محمد',
    direction: 'received',
    type: 'text',
    timestampIso: '2026-06-07T08:30:00.000Z',
    dateKey: '2026-06-07',
    body: 'مرحبا 👋',
  },
  {
    kind: 'message',
    id: 'm-2',
    senderId: 'me',
    senderDisplayName: 'You',
    direction: 'sent',
    type: 'text',
    timestampIso: '2026-06-07T08:31:00.000Z',
    dateKey: '2026-06-07',
    body: 'Hello!',
  },
];

describe('applyPreviewPrivacy (FR-004, plan §1)', () => {
  it('hides the contact name in participants and received rows', () => {
    const settings: PrivacySettings = { showContactName: false, showPhoneNumber: false };
    const result = applyPreviewPrivacy(participants, messages, settings);

    expect(result.participants[1]?.displayName).toBe(PRIVACY_NAME_PLACEHOLDER);
    expect(result.messages[0]?.senderDisplayName).toBe(PRIVACY_NAME_PLACEHOLDER);
  });

  it('applies an alias everywhere the contact name appears', () => {
    const settings: PrivacySettings = {
      showContactName: true,
      displayAlias: 'Friend',
      showPhoneNumber: false,
    };
    const result = applyPreviewPrivacy(participants, messages, settings);

    expect(result.participants[1]?.displayName).toBe('Friend');
    expect(result.messages[0]?.senderDisplayName).toBe('Friend');
  });

  it('echoes the applied settings for client parity (FR-021)', () => {
    const settings: PrivacySettings = { showContactName: true, showPhoneNumber: true };
    const result = applyPreviewPrivacy(participants, messages, settings);

    expect(result.appliedPrivacy).toEqual(settings);
  });

  it('never alters the local user or message bodies', () => {
    const settings: PrivacySettings = {
      showContactName: false,
      displayAlias: 'Friend',
      showPhoneNumber: false,
    };
    const result = applyPreviewPrivacy(participants, messages, settings);

    expect(result.participants[0]?.displayName).toBe('You');
    expect(result.messages[1]?.senderDisplayName).toBe('You');
    expect(result.messages.map((m) => m.body)).toEqual(messages.map((m) => m.body));
  });
});
