import { Hono } from 'hono';
import type { HealthResponse } from '../shared/health.ts';

const HEALTHY: HealthResponse = { status: 'ok' };

/** Builds the HomeHub Hono app; main.ts serves it and tests call app.request(). */
export function createApp() {
  return new Hono().get('/api/health', (c) => c.json(HEALTHY));
}

/** The app's routes as types, for the web app's typed client (SRV-1, SRV-3). */
export type AppType = ReturnType<typeof createApp>;
