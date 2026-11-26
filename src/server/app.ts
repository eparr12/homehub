import type Database from 'better-sqlite3';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { Logger } from 'pino';
import { HEALTH_PATH, type HealthResponse } from '../shared/health.ts';
import type { MeResponse } from '../shared/me.ts';
import type { AllowedUsers } from './config.ts';
import { checkDatabase } from './db/connection.ts';
import { handleError, handleNotFound } from './middleware/errors.ts';
import { identity } from './middleware/identity.ts';
import { ownHost } from './middleware/own-host.ts';
import { type RequestEnv, requestLog } from './middleware/request-log.ts';
import { noWebFiles, webFiles } from './middleware/web-files.ts';

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * The cap on an /api request body (SEC-5). Every body is small JSON until
 * Phase 5's photo upload, which gets its own limit.
 */
export const API_BODY_LIMIT_BYTES = 100 * 1024;

/** What the app needs from main.ts or a test (TS-11). */
export interface AppDependencies {
  readonly db: Database.Database;
  readonly log: Logger;
  readonly allowedUsers: AllowedUsers;
  /** The login that a request without a login header counts as, in development only. */
  readonly devUser?: string | undefined;
  /** The production web build to serve, or none to answer /api alone. */
  readonly webDir?: string | undefined;
  /** What GET /api/health reports as the version: the image's commit, or dev. */
  readonly version: string;
}

/** Builds the HomeHub Hono app; main.ts serves it and tests call app.request(). */
export function createApp({
  db,
  log,
  allowedUsers,
  devUser,
  webDir,
  version,
}: AppDependencies) {
  const healthy: HealthResponse = { status: 'ok', database: 'ok', version };
  // A status report, not Problem Details: Docker's health check and the wall's
  // status tile read it, and it never carries the error or a path (SRV-6).
  const unhealthy: HealthResponse = {
    status: 'error',
    database: 'error',
    version,
  };
  // Hono runs handlers in the order they're added, so the order is the
  // security boundary: a route added above ownHost or identity would skip it.
  return (
    new Hono<RequestEnv>()
      .onError(handleError)
      .notFound(handleNotFound)
      .use(requestId())
      .use(requestLog(log))
      .use(
        secureHeaders({
          // The app's own origin only (SEC-8). default-src doesn't cover
          // base-uri, form-action or frame-ancestors, so they're set too.
          contentSecurityPolicy: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
          },
        }),
      )
      // Before any route, file or identity, so another site's name gets
      // nothing, and below the middleware above, so the refusal still gets
      // security headers and a request ID (SEC-3, SEC-8, OBS-5).
      .use(ownHost())
      // Checks form and text bodies, which a page on another origin can send
      // without a CORS preflight; JSON needs one, and nothing answers it
      // (SEC-4). Behind Serve the request URL starts with http://, so the
      // Origin check never matches the https:// page, and same-origin posts
      // pass on Sec-Fetch-Site, which current browsers send.
      .use(csrf())
      // Open, for Docker's health check (SRV-6), but below the middleware
      // above, so it still gets the Host check, security headers and a
      // request ID (SEC-3, SEC-8, OBS-5).
      .get(HEALTH_PATH, (c) => {
        const check = checkDatabase(db);
        if (check.ok) return c.json(healthy, HTTP_OK);
        c.get('log').error({ err: check.error }, 'database check failed');
        return c.json(unhealthy, HTTP_SERVICE_UNAVAILABLE);
      })
      // Every route below needs an allowed Tailscale identity (SEC-3).
      .use('/api/*', identity({ allowedUsers, devUser }))
      .use('/api/*', bodyLimit({ maxSize: API_BODY_LIMIT_BYTES }))
      .get('/api/me', (c) => {
        const { shortName, displayName } = c.get('user');
        const me: MeResponse = { shortName, displayName };
        return c.json(me, HTTP_OK);
      })
      // Last, below every /api route, and open: the web app's files hold no
      // data until the app calls /api, which needs an identity.
      .use(webDir === undefined ? noWebFiles : webFiles(webDir))
  );
}

/** The app's routes as types, for the web app's typed client (SRV-1, SRV-3). */
export type AppType = ReturnType<typeof createApp>;
