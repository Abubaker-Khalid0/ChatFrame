import { describe, expect, it } from 'vitest';
import {
  HealthCheckResultSchema,
  SessionStatusSchema,
  SsePingEventSchema,
  SseSessionQrEventSchema,
  SseSessionStateEventSchema,
} from './session';

const validHealthCheck = {
  available: true,
  checkedAt: '2026-06-11T10:00:00Z',
  error: null,
};

const validStatus = {
  state: 'connected',
  isRestoring: false,
  healthCheck: validHealthCheck,
  connectedAt: '2026-06-11T10:00:15Z',
  error: null,
};

describe('SessionStatusSchema', () => {
  it('accepts a valid connected status', () => {
    expect(SessionStatusSchema.parse(validStatus)).toEqual(validStatus);
  });

  it('accepts a disconnected status with null connectedAt', () => {
    const status = { ...validStatus, state: 'disconnected', connectedAt: null };
    expect(SessionStatusSchema.parse(status)).toEqual(status);
  });

  it('rejects an unknown connection state (enum rejection)', () => {
    expect(SessionStatusSchema.safeParse({ ...validStatus, state: 'sleeping' }).success).toBe(
      false,
    );
  });

  it('rejects a non-ISO connectedAt timestamp', () => {
    expect(
      SessionStatusSchema.safeParse({ ...validStatus, connectedAt: 'yesterday' }).success,
    ).toBe(false);
  });

  it('rejects a status missing the health check', () => {
    const { healthCheck: _omitted, ...rest } = validStatus;
    expect(SessionStatusSchema.safeParse(rest).success).toBe(false);
  });
});

describe('HealthCheckResultSchema', () => {
  it('accepts a failing health check with a diagnostic error', () => {
    const failed = { available: false, checkedAt: '2026-06-11T10:00:00Z', error: 'no chromium' };
    expect(HealthCheckResultSchema.parse(failed)).toEqual(failed);
  });

  it('rejects a missing checkedAt', () => {
    expect(HealthCheckResultSchema.safeParse({ available: true, error: null }).success).toBe(false);
  });
});

describe('SseSessionStateEventSchema', () => {
  it('accepts every valid connection state', () => {
    const states = [
      'disconnected',
      'initializing',
      'waiting_for_qr',
      'qr_ready',
      'connecting',
      'connected',
      'session_expired',
      'connection_failed',
    ];
    for (const state of states) {
      expect(SseSessionStateEventSchema.parse({ state, error: null })).toEqual({
        state,
        error: null,
      });
    }
  });

  it('rejects an invalid state value', () => {
    expect(SseSessionStateEventSchema.safeParse({ state: 'offline', error: null }).success).toBe(
      false,
    );
  });
});

describe('SseSessionQrEventSchema', () => {
  it('accepts a QR payload with a positive expiresIn', () => {
    const event = { qr: '2@abc123', expiresIn: 20 };
    expect(SseSessionQrEventSchema.parse(event)).toEqual(event);
  });

  it('rejects zero or negative expiresIn (positivity)', () => {
    expect(SseSessionQrEventSchema.safeParse({ qr: '2@abc123', expiresIn: 0 }).success).toBe(false);
    expect(SseSessionQrEventSchema.safeParse({ qr: '2@abc123', expiresIn: -5 }).success).toBe(
      false,
    );
  });

  it('rejects a non-integer expiresIn', () => {
    expect(SseSessionQrEventSchema.safeParse({ qr: '2@abc123', expiresIn: 1.5 }).success).toBe(
      false,
    );
  });

  it('rejects an empty QR string', () => {
    expect(SseSessionQrEventSchema.safeParse({ qr: '', expiresIn: 20 }).success).toBe(false);
  });
});

describe('SsePingEventSchema', () => {
  it('accepts an ISO timestamp and rejects garbage', () => {
    expect(SsePingEventSchema.parse({ timestamp: '2026-06-11T10:00:30Z' })).toEqual({
      timestamp: '2026-06-11T10:00:30Z',
    });
    expect(SsePingEventSchema.safeParse({ timestamp: 'noon' }).success).toBe(false);
  });
});
