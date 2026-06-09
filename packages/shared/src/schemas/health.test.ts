import { describe, expect, it } from 'vitest';
import { HealthStatusSchema } from './health';

describe('HealthStatusSchema', () => {
  it('accepts a minimal healthy body', () => {
    expect(HealthStatusSchema.safeParse({ status: 'ok' }).success).toBe(true);
  });

  it('accepts a full body with service and ISO timestamp', () => {
    const result = HealthStatusSchema.safeParse({
      status: 'ok',
      service: 'chatframe-backend',
      timestamp: '2026-06-09T17:16:06.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-ok status', () => {
    expect(HealthStatusSchema.safeParse({ status: 'down' }).success).toBe(false);
  });

  it('rejects a missing status', () => {
    expect(HealthStatusSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a non-ISO timestamp', () => {
    expect(HealthStatusSchema.safeParse({ status: 'ok', timestamp: 'yesterday' }).success).toBe(
      false,
    );
  });
});
