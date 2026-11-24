import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALEX_HEADERS,
  createTestApp,
  makeTempDir,
  readProblem,
} from '../test-support.ts';

// A folder shaped like dist/web: each file's path in it, and its content.
const WEB_FILES = {
  'index.html': '<!doctype html><title>HomeHub</title>',
  'sw.js': 'self.skipWaiting;',
  'workbox-2fbc6a65.js': 'self.workbox;',
  'manifest.webmanifest': '{"name":"HomeHub"}',
  'pwa-192x192.png': 'PNG',
  'assets/index-Btv5KHVt.js': 'console.log("app");',
  'assets/index-C7StvsKe.css': 'body{margin:0}',
  // Where photos will be served from, so a test proves that /media never
  // reaches the web folder, even for a file that's there.
  'media/photos/1/wall.webp': 'WEBP',
} as const;
// Beside the web folder, where no request may reach it.
const SECRET_FILE = 'secret.txt';
const SHELL = WEB_FILES['index.html'];
const HTML = 'text/html; charset=utf-8';
const JAVASCRIPT = 'text/javascript; charset=utf-8';
const CSS = 'text/css; charset=utf-8';
const MANIFEST = 'application/manifest+json';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const NO_CACHE = 'no-cache';
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** Writes WEB_FILES into a new web folder, with SECRET_FILE beside it. */
function makeWebDir(): string {
  const dir = makeTempDir();
  const webDir = join(dir, 'web');
  for (const [file, content] of Object.entries(WEB_FILES)) {
    mkdirSync(dirname(join(webDir, file)), { recursive: true });
    writeFileSync(join(webDir, file), content);
  }
  writeFileSync(join(dir, SECRET_FILE), 'never served');
  return webDir;
}

/** Builds the app on a new web folder from makeWebDir(). */
async function createWebApp() {
  return createTestApp({ webDir: makeWebDir() });
}

/** What a response says about the file it carries and how to cache it. */
async function readServedFile(response: Response) {
  return {
    status: response.status,
    type: response.headers.get('Content-Type'),
    cacheControl: response.headers.get('Cache-Control'),
    body: await response.text(),
  };
}

/** Checks for the 404 problem, which carries no file and no index.html. */
async function expectNotFound(response: Response): Promise<void> {
  expect({
    status: response.status,
    body: await readProblem(response),
  }).toEqual({
    status: 404,
    body: {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      requestId: response.headers.get('X-Request-Id'),
    },
  });
}

describe('web files', () => {
  it.each([
    { file: 'index.html', type: HTML, cache: NO_CACHE },
    { file: 'sw.js', type: JAVASCRIPT, cache: NO_CACHE },
    { file: 'workbox-2fbc6a65.js', type: JAVASCRIPT, cache: NO_CACHE },
    { file: 'manifest.webmanifest', type: MANIFEST, cache: NO_CACHE },
    { file: 'pwa-192x192.png', type: 'image/png', cache: NO_CACHE },
    { file: 'assets/index-Btv5KHVt.js', type: JAVASCRIPT, cache: IMMUTABLE },
    { file: 'assets/index-C7StvsKe.css', type: CSS, cache: IMMUTABLE },
  ] as const)(
    'serves /$file with its type and Cache-Control: $cache',
    async ({ file, type, cache }) => {
      const app = await createWebApp();

      const response = await app.request(`/${file}`);

      expect(await readServedFile(response)).toEqual({
        status: 200,
        type,
        cacheControl: cache,
        body: WEB_FILES[file],
      });
    },
  );

  it.each([
    '/',
    '/wall',
    '/photos',
    '/holidays',
    '/no-such-view',
    '/wall/',
    // Starts like /api but isn't under it.
    '/apiary',
  ])(
    'answers the app path %s with index.html and Cache-Control: no-cache',
    async (path) => {
      const app = await createWebApp();

      const response = await app.request(path);

      expect(await readServedFile(response)).toEqual({
        status: 200,
        type: HTML,
        cacheControl: NO_CACHE,
        body: SHELL,
      });
    },
  );

  it('answers HEAD /wall with the headers of index.html and no body', async () => {
    const app = await createWebApp();

    const response = await app.request('/wall', { method: 'HEAD' });

    expect({
      ...(await readServedFile(response)),
      length: response.headers.get('Content-Length'),
    }).toEqual({
      status: 200,
      type: HTML,
      cacheControl: NO_CACHE,
      body: '',
      length: String(Buffer.byteLength(SHELL)),
    });
  });

  it('sends index.html with the Content-Security-Policy', async () => {
    const app = await createWebApp();

    const response = await app.request('/wall');

    expect({
      body: await response.text(),
      contentSecurityPolicy: response.headers.get('Content-Security-Policy'),
    }).toEqual({ body: SHELL, contentSecurityPolicy: CONTENT_SECURITY_POLICY });
  });

  it.each([
    { case: 'an old name under /assets', path: '/assets/index-OldHash1.js' },
    { case: 'a file the build lacks', path: '/favicon.ico' },
    { case: 'a file beside the web folder', path: `/${SECRET_FILE}` },
    { case: 'an encoded slash', path: `/..%2F${SECRET_FILE}` },
    { case: 'encoded dots', path: `/%2e%2e/${SECRET_FILE}` },
    {
      case: 'encoded backslashes',
      path: `/assets/..%5C..%5C${SECRET_FILE}`,
    },
  ])(
    'answers $path, $case, with the 404 problem and never index.html',
    async ({ path }) => {
      const app = await createWebApp();

      const response = await app.request(path);

      await expectNotFound(response);
    },
  );

  it.each([
    '/api',
    '/api/no-such-route',
    '/media',
    '/media/photos/1/wall.webp',
  ])(
    'answers %s with the 404 problem, never a file or index.html, even with an allowed login',
    async (path) => {
      const app = await createWebApp();

      const response = await app.request(path, { headers: ALEX_HEADERS });

      await expectNotFound(response);
    },
  );

  it('answers POST /wall with the 404 problem', async () => {
    const app = await createWebApp();

    // Marked same-origin, like the app's own requests, so csrf passes it on.
    const response = await app.request('/wall', {
      method: 'POST',
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    });

    await expectNotFound(response);
  });

  it('answers an app path with the 404 problem once index.html is gone, as during a rebuild', async () => {
    const webDir = makeWebDir();
    const app = await createTestApp({ webDir });
    rmSync(join(webDir, 'index.html'));

    const response = await app.request('/wall');

    await expectNotFound(response);
  });

  it('answers / with the 404 problem when there is no web folder', async () => {
    const app = await createTestApp();

    const response = await app.request('/');

    await expectNotFound(response);
  });
});
