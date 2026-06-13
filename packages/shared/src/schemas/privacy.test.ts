import { describe, expect, it } from 'vitest';
import {
  PRIVACY_NAME_PLACEHOLDER,
  applyPrivacyToMessageRow,
  applyPrivacyToParticipants,
  displayNameFor,
  phoneNumberFor,
} from './privacy';
import type { Participant } from './participant';
import type { MessageRow } from './render';
import type { PrivacySettings } from './view-settings';

const DEFAULTS: PrivacySettings = { showContactName: true, showPhoneNumber: false };

const participants: Participant[] = [
  { id: 'me', displayName: 'You', isMe: true },
  { id: 'contact-001', displayName: 'أحمد محمد', isMe: false },
];

const receivedRow: MessageRow = {
  kind: 'message',
  id: 'm-1',
  senderId: 'contact-001',
  senderDisplayName: 'أحمد محمد',
  direction: 'received',
  type: 'text',
  timestampIso: '2026-06-07T08:30:00.000Z',
  dateKey: '2026-06-07',
  body: 'السلام عليكم! كيف حالك اليوم؟',
};

const sentRow: MessageRow = {
  ...receivedRow,
  id: 'm-2',
  senderId: 'me',
  senderDisplayName: 'You',
  direction: 'sent',
  body: 'Hello back',
};

describe('displayNameFor (data-model §3)', () => {
  it('returns the original name under default settings', () => {
    expect(displayNameFor('أحمد محمد', false, DEFAULTS)).toBe('أحمد محمد');
  });

  it('replaces the name with the alias when displayAlias is set', () => {
    const settings: PrivacySettings = { ...DEFAULTS, displayAlias: 'Friend' };
    expect(displayNameFor('أحمد محمد', false, settings)).toBe('Friend');
  });

  it('alias takes precedence over the hide toggle', () => {
    const settings: PrivacySettings = {
      showContactName: false,
      displayAlias: 'Friend',
      showPhoneNumber: false,
    };
    expect(displayNameFor('أحمد محمد', false, settings)).toBe('Friend');
  });

  it('returns the stable placeholder token when the name is hidden', () => {
    const settings: PrivacySettings = { ...DEFAULTS, showContactName: false };
    expect(displayNameFor('أحمد محمد', false, settings)).toBe(PRIVACY_NAME_PLACEHOLDER);
  });

  it('never alters the local user, even when hidden or aliased', () => {
    const settings: PrivacySettings = {
      showContactName: false,
      displayAlias: 'Friend',
      showPhoneNumber: false,
    };
    expect(displayNameFor('You', true, settings)).toBe('You');
  });
});

describe('phoneNumberFor (data-model §3)', () => {
  it('returns the phone when showPhoneNumber is on', () => {
    const settings: PrivacySettings = { ...DEFAULTS, showPhoneNumber: true };
    expect(phoneNumberFor('+966501234567', settings)).toBe('+966501234567');
  });

  it('omits the phone when showPhoneNumber is off', () => {
    expect(phoneNumberFor('+966501234567', DEFAULTS)).toBeUndefined();
  });
});

describe('applyPrivacyToParticipants', () => {
  it('hides only the contact name, leaving the local user unchanged', () => {
    const settings: PrivacySettings = { ...DEFAULTS, showContactName: false };
    const result = applyPrivacyToParticipants(participants, settings);

    expect(result[0]).toEqual(participants[0]);
    expect(result[1]?.displayName).toBe(PRIVACY_NAME_PLACEHOLDER);
    // The input is never mutated (pure transform).
    expect(participants[1]?.displayName).toBe('أحمد محمد');
  });

  it('applies the alias to every non-local participant', () => {
    const settings: PrivacySettings = { ...DEFAULTS, displayAlias: 'Friend' };
    const result = applyPrivacyToParticipants(participants, settings);

    expect(result.map((p) => p.displayName)).toEqual(['You', 'Friend']);
  });
});

describe('applyPrivacyToMessageRow', () => {
  it('replaces the sender name on received rows when hidden', () => {
    const settings: PrivacySettings = { ...DEFAULTS, showContactName: false };
    const result = applyPrivacyToMessageRow(receivedRow, settings);

    expect(result.senderDisplayName).toBe(PRIVACY_NAME_PLACEHOLDER);
  });

  it('leaves sent rows (the local user) unchanged', () => {
    const settings: PrivacySettings = {
      showContactName: false,
      displayAlias: 'Friend',
      showPhoneNumber: false,
    };
    expect(applyPrivacyToMessageRow(sentRow, settings)).toEqual(sentRow);
  });

  it('never alters the message body or reply preview text', () => {
    const rowWithReply: MessageRow = {
      ...receivedRow,
      replyTo: { resolved: true, previewText: 'أحمد محمد said hi', previewType: 'text' },
    };
    const settings: PrivacySettings = {
      showContactName: false,
      displayAlias: 'Friend',
      showPhoneNumber: false,
    };
    const result = applyPrivacyToMessageRow(rowWithReply, settings);

    expect(result.body).toBe(rowWithReply.body);
    expect(result.replyTo).toEqual(rowWithReply.replyTo);
  });

  it('returns the identical row when nothing changes (cheap referential reuse)', () => {
    expect(applyPrivacyToMessageRow(receivedRow, DEFAULTS)).toBe(receivedRow);
  });
});
