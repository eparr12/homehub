import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALEX_HEADERS,
  captureLogs,
  createTestApp,
  makeTempDir,
  readProblem,
} from '../test-support.ts';

// The name of a page that points it at 127.0.0.1 (DNS rebinding).
const OTHER_SITE = 'attacker.example';
// A made-up name on the tailnet: the real one stays out of the repo (GIT-7).
const TAILNET_NAME = 'homehub.example-tailnet.ts.net';
// What a page under a rebound name sends: a forged login, and the
// Sec-Fetch-Site that csrf lets through, since to the browser the server is
// the page's own origin.
const REBOUND_PAGE_HEADERS = {
  ...ALEX_HEADERS,
  'Sec-Fetch-Site': 'same-origin',
} as const;
const ASSET = 'assets/index-Btv5KHVt.js';
// Hono's method for middleware added with use() and handlers added with all().
const ANY_METHOD = 'ALL';
// Route parameters and wildcards, replaced so that a request matches its route.
const PATH_PATTERN_PARTS = /:[^/]+|\*/g;

/** Builds the app on a web folder that holds index.html and one asset. */
async function createWebApp() {
  const webDir = join(makeTempDir(), 'web');
  mkdirSync(join(webDir, 'assets'), { recursive: true });
  writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>x</title>');
  writeFileSync(join(webDir, ASSET), 'console.log("app");');
  return createTestApp({ webDir });
}

/** Checks for the 421 problem that refuses a name that isn't the server's. */
async function expectMisdirected(response: Response): Promise<void> {
  expect({
    status: response.status,
    body: await readProblem(response),
  }).toEqual({
    status: 421,
    body: {
      type: 'about:blank',
      title: 'Misdirected Request',
      status: 421,
      detail: "The request's Host isn't one of the server's names.",
      requestId: response.headers.get('X-Request-Id'),
    },
  });
}

describe('own host', () => {
  it.each([
    OTHER_SITE,
    `${OTHER_SITE}:8080`,
    'ts.net.attacker.example',
    // ts.net without the dot before it.
    'attackerts.net',
    `${TAILNET_NAME}.attacker.example`,
    // To a browser, a second origin, with its own offline data.
    `${TAILNET_NAME}.`,
    // A page under a rebound name has to name the server's port. Two ports,
    // so that a check of only one of them fails.
    `${TAILNET_NAME}:8080`,
    'evil.example-tailnet.ts.net:8443',
    '0.0.0.0:8080',
    '192.168.1.20:8080',
  ])(
    'refuses the Host %s with the 421 problem, even with an allowed login',
    async (host) => {
      const app = await createTestApp();

      const response = await app.request(`http://${host}/api/me`, {
        headers: ALEX_HEADERS,
      });

      await expectMisdirected(response);
    },
  );

  it.each([
    'localhost',
    'localhost:8081',
    '127.0.0.1:8080',
    '[::1]:8080',
    TAILNET_NAME,
    'HomeHub.Example-Tailnet.TS.Net',
  ])('lets the Host %s through to the route', async (host) => {
    const app = await createTestApp();

    const response = await app.request(`http://${host}/api/me`, {
      headers: ALEX_HEADERS,
    });

    expect(response.status).toBe(200);
  });

  it.each(['POST', 'PUT', 'DELETE', 'OPTIONS'])(
    "refuses %s under another site's name with the 421 problem",
    async (method) => {
      const app = await createTestApp();

      const response = await app.request(`http://${OTHER_SITE}/api/me`, {
        method,
        headers: REBOUND_PAGE_HEADERS,
      });

      await expectMisdirected(response);
    },
  );

  it.each([
    '/api/health',
    '/api/me',
    '/',
    '/wall',
    `/${ASSET}`,
    // A file the build lacks.
    '/favicon.ico',
  ])(
    "refuses another site's name on %s before a route or a file answers",
    async (path) => {
      const app = await createWebApp();

      const response = await app.request(`http://${OTHER_SITE}${path}`, {
        headers: ALEX_HEADERS,
      });

      await expectMisdirected(response);
    },
  );

  // A route registered above the check would answer, because Hono runs
  // handlers in the order they were added.
  it("answers another site's name with 421 on every route", async () => {
    const app = await createWebApp();

    const answers = await Promise.all(
      app.routes.map(async ({ method, path }) => {
        const response = await app.request(
          `http://${OTHER_SITE}${path.replaceAll(PATH_PATTERN_PARTS, 'x')}`,
          {
            // GET for middleware, which the web files answer.
            method: method === ANY_METHOD ? 'GET' : method,
            headers: REBOUND_PAGE_HEADERS,
          },
        );
        return `${method} ${path} ${String(response.status)}`;
      }),
    );

    expect(answers).toContain('GET /api/me 421');
    expect(answers).toEqual(
      app.routes.map(({ method, path }) => `${method} ${path} 421`),
    );
  });

  it('logs a refusal with its reason, the refused Host with its port and the request ID, never the login or short name', async () => {
    const { log, lines } = captureLogs();
    const app = await createTestApp({ log });

    const response = await app.request(`http://${OTHER_SITE}:8080/api/me`, {
      headers: ALEX_HEADERS,
    });

    expect(lines[0]).toEqual({
      level: 'warn',
      requestId: response.headers.get('X-Request-Id'),
      reason: "Host not one of the server's names",
      refusedHost: `${OTHER_SITE}:8080`,
      msg: 'request refused',
    });
  });
});
