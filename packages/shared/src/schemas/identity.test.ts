import { describe, expect, it } from 'vitest';
import { isSerializedWhatsAppId, phoneFromWhatsAppId, sanitizeContactName } from './identity';

describe('isSerializedWhatsAppId', () => {
  it('is true for serialized JIDs', () => {
    expect(isSerializedWhatsAppId('15551234567@c.us')).toBe(true);
    expect(isSerializedWhatsAppId('222436708581508@lid')).toBe(true);
    expect(isSerializedWhatsAppId('120363000000000000@g.us')).toBe(true);
  });

  it('is false for bare tokens (mock/test ids)', () => {
    expect(isSerializedWhatsAppId('contact-001')).toBe(false);
    expect(isSerializedWhatsAppId('me')).toBe(false);
  });
});

describe('phoneFromWhatsAppId', () => {
  it('returns +<digits> for a phone-based @c.us id', () => {
    expect(phoneFromWhatsAppId('15551234567@c.us')).toBe('+15551234567');
  });

  it('returns +<digits> for a @s.whatsapp.net id', () => {
    expect(phoneFromWhatsAppId('966501234567@s.whatsapp.net')).toBe('+966501234567');
  });

  it('returns +<digits> for a bare numeric id (legacy/mock data)', () => {
    expect(phoneFromWhatsAppId('15551234567')).toBe('+15551234567');
  });

  it('never derives a phone number from a @lid privacy id', () => {
    // The numeric user part of a @lid is an opaque Linked ID, not an MSISDN.
    expect(phoneFromWhatsAppId('222436708581508@lid')).toBeUndefined();
  });

  it('returns undefined for groups and non-numeric ids', () => {
    expect(phoneFromWhatsAppId('120363000000000000@g.us')).toBeUndefined();
    expect(phoneFromWhatsAppId('mock-contact')).toBeUndefined();
    expect(phoneFromWhatsAppId('abc@c.us')).toBeUndefined();
  });
});

describe('sanitizeContactName', () => {
  it('keeps a real name (trimmed)', () => {
    expect(sanitizeContactName('  Sarah Johnson  ')).toBe('Sarah Johnson');
    expect(sanitizeContactName('أحمد محمد')).toBe('أحمد محمد');
  });

  it('returns null for a missing or empty name', () => {
    expect(sanitizeContactName(null)).toBeNull();
    expect(sanitizeContactName(undefined)).toBeNull();
    expect(sanitizeContactName('   ')).toBeNull();
  });

  it('rejects a serialized id masquerading as a name', () => {
    expect(sanitizeContactName('222436708581508@lid')).toBeNull();
    expect(sanitizeContactName('15551234567@c.us')).toBeNull();
  });
});
