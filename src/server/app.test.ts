import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '../shared/health.ts';
import { createApp } from './app.ts';

describe('GET /api/health', () => {
  it('reports that the server is up', async () => {
    const app = createApp();

    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      status: 'ok',
    });
  });
});
