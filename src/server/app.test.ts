import { describe, expect, it } from 'vitest';
import { HEALTH_PATH, healthResponseSchema } from '../shared/health.ts';
import { createApp } from './app.ts';
import {
  ALEX_HEADERS,
  ALLOWED_USERS,
  captureLogs,
  createTestApp,
  openMigratedDatabase,
} from './test-support.ts';

// Hono's method for middleware added with use() and handlers added with all().
const ANY_METHOD = 'ALL';
// Route parameters and wildcards, replaced so that a request matches its route.
const PATH_PATTERN_PARTS = /:[^/]+|\*/g;

describe('GET /api/health', () => {
  it('reports that the server and its database are ok', async () => {
    const app = createApp({
      db: await openMigratedDatabase(),
      log: captureLogs().log,
      allowedUsers: ALLOWED_USERS,
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
    const app = createApp({
      db,
      log: captureLogs().log,
      allowedUsers: ALLOWED_USERS,
    });

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
    const app = createApp({ db, log, allowedUsers: ALLOWED_USERS });

    await app.request('/api/health');

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'error',
      msg: 'database check failed',
      err: { message: 'The database connection is not open' },
    });
  });

  it('logs a failed database check with the request ID', async () => {
    const db = await openMigratedDatabase();
    db.close();
    const { log, lines } = captureLogs();
    const app = await createTestApp({ db, log });

    const response = await app.request('/api/health');

    expect(lines[0]).toMatchObject({
      msg: 'database check failed',
      requestId: response.headers.get('X-Request-Id'),
    });
  });
});

describe('GET /api/me', () => {
  it('answers an allowed login with its short name and display name', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/me', { headers: ALEX_HEADERS });

    expect(response.status).toBe(200);
    // Compared raw, so a leaked login or any other extra field fails.
    expect(await response.json()).toEqual({
      shortName: 'alex',
      displayName: 'Alex Example',
    });
  });
});

describe('route registration', () => {
  // A route registered above the identity middleware would skip it, because
  // Hono runs handlers in the order they were added (SRV-6).
  it('answers 401 without an identity on every /api route but GET /api/health', async () => {
    const app = await createTestApp();
    const guarded = app.routes.filter(
      ({ method, path }) =>
        path.startsWith('/api/') && !(method === 'GET' && path === HEALTH_PATH),
    );

    const answers = await Promise.all(
      guarded.map(async ({ method, path }) => {
        const response = await app.request(
          path.replaceAll(PATH_PATTERN_PARTS, 'x'),
          {
            // POST for middleware, because GET /api/health is open. Marked
            // same-origin, like the app's own requests, so csrf passes it on.
            method: method === ANY_METHOD ? 'POST' : method,
            headers: { 'Sec-Fetch-Site': 'same-origin' },
          },
        );
        return `${method} ${path} ${String(response.status)}`;
      }),
    );

    expect(answers).toContain('GET /api/me 401');
    expect(answers).toEqual(
      guarded.map(({ method, path }) => `${method} ${path} 401`),
    );
  });
});
