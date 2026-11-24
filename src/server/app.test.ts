import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '../shared/health.ts';
import { createApp } from './app.ts';
import { captureLogs, openMigratedDatabase } from './test-support.ts';

describe('GET /api/health', () => {
  it('reports that the server and its database are ok', async () => {
    const app = createApp({
      db: await openMigratedDatabase(),
      log: captureLogs().log,
    });

    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('answers 503 with only the status fields when the database fails', async () => {
    const db = await openMigratedDatabase();
    db.close();
    const app = createApp({ db, log: captureLogs().log });

    const response = await app.request('/api/health');

    expect(response.status).toBe(503);
    // Compared raw: parsing with the schema would drop any extra field, such
    // as leaked error text or a file path (SRV-6).
    expect(await response.json()).toEqual({
      status: 'error',
      database: 'error',
    });
  });

  it('logs a failed database check once', async () => {
    const db = await openMigratedDatabase();
    db.close();
    const { log, lines } = captureLogs();
    const app = createApp({ db, log });

    await app.request('/api/health');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'error',
      msg: 'database check failed',
      err: { message: 'The database connection is not open' },
    });
  });
});
