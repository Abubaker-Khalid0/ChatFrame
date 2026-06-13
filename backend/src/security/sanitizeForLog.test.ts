import { describe, expect, it } from 'vitest';
import { sanitizeForLog } from './sanitizeForLog';

describe('sanitizeForLog (FR-013)', () => {
  it('redacts values under sensitive keys', () => {
    const result = sanitizeForLog({
      qr: '2@abcdefghijklmnop',
      token: 'tok_123',
      authToken: 'bearer xyz',
      secret: 's3cr3t',
      password: 'hunter2',
      state: 'connected',
    }) as Record<string, unknown>;

    expect(result.qr).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.authToken).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
    expect(result.state).toBe('connected');
  });

  it('redacts QR-shaped string values regardless of their key', () => {
    const result = sanitizeForLog({
      payload: '2@AAAABBBBCCCCDDDD,EEEEFFFF==',
      note: 'hello world',
    }) as Record<string, unknown>;

    expect(result.payload).toBe('[REDACTED]');
    expect(result.note).toBe('hello world');
  });

  it('sanitizes nested objects and arrays', () => {
    const result = sanitizeForLog({
      session: { data: { refreshToken: 'abc', label: 'ok' } },
      events: [{ qr: '2@deadbeefdeadbeef' }, 'plain'],
    }) as {
      session: { data: { refreshToken: string; label: string } };
      events: [Record<string, unknown>, string];
    };

    expect(result.session.data.refreshToken).toBe('[REDACTED]');
    expect(result.session.data.label).toBe('ok');
    expect(result.events[0].qr).toBe('[REDACTED]');
    expect(result.events[1]).toBe('plain');
  });

  it('passes through primitives untouched', () => {
    expect(sanitizeForLog('hello')).toBe('hello');
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog(null)).toBe(null);
    expect(sanitizeForLog(undefined)).toBe(undefined);
    expect(sanitizeForLog(true)).toBe(true);
  });

  it('redacts a bare QR string value', () => {
    expect(sanitizeForLog('2@abcdefghijklmnop,qrstuvwx==')).toBe('[REDACTED]');
  });

  it('handles circular structures without throwing', () => {
    const obj: Record<string, unknown> = { name: 'loop' };
    obj.self = obj;
    const result = sanitizeForLog(obj) as Record<string, unknown>;
    expect(result.name).toBe('loop');
    expect(result.self).toBe('[REDACTED]');
  });

  it('sanitizes Error objects while keeping name and stack', () => {
    const error = new Error('2@abcdefghijklmnop');
    const result = sanitizeForLog(error) as { name: string; message: string; stack?: string };
    expect(result.name).toBe('Error');
    expect(result.message).toBe('[REDACTED]');
    expect(typeof result.stack).toBe('string');
  });

  it('does not mutate the original payload', () => {
    const payload = { qr: '2@abcdefghijklmnop', deep: { token: 'x' } };
    sanitizeForLog(payload);
    expect(payload.qr).toBe('2@abcdefghijklmnop');
    expect(payload.deep.token).toBe('x');
  });
});
