import { afterAll, describe, expect, it } from 'vitest';
import { HealthStatusSchema } from '@chatframe/shared';
import { buildApp } from '../../app';

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe('GET /api/health', () => {
  it('returns 200 with a schema-valid ok status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);

    const parsed = HealthStatusSchema.safeParse(res.json());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.status).toBe('ok');
  });
});
