import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { HealthResponse } from '../shared/health.ts';
import { checkDatabase } from './db/connection.ts';

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HEALTHY: HealthResponse = { status: 'ok', database: 'ok' };
// A status report, not Problem Details: Docker's health check and the wall's
// status tile read it, and it never carries the error or a path (SRV-6).
const UNHEALTHY: HealthResponse = { status: 'error', database: 'error' };

/** What the app needs from main.ts or a test (TS-11). */
export interface AppDependencies {
  readonly db: Database.Database;
  readonly log: Logger;
}

/** Builds the HomeHub Hono app; main.ts serves it and tests call app.request(). */
export function createApp({ db, log }: AppDependencies) {
  return new Hono().get('/api/health', (c) => {
    const check = checkDatabase(db);
    if (check.ok) return c.json(HEALTHY, HTTP_OK);
    log.error({ err: check.error }, 'database check failed');
    return c.json(UNHEALTHY, HTTP_SERVICE_UNAVAILABLE);
  });
}

/** The app's routes as types, for the web app's typed client (SRV-1, SRV-3). */
export type AppType = ReturnType<typeof createApp>;
