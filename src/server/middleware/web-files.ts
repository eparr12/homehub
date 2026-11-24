import { serveStatic } from '@hono/node-server/serve-static';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { SERVER_PATH_PREFIXES } from '../../shared/server-paths.ts';
import type { RequestEnv } from './request-log.ts';

/** The app shell, which every view of the web app starts from. */
export const SHELL_FILE = 'index.html';

const READ_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);
const CACHE_CONTROL = 'Cache-Control';
// Vite puts a hash of each file's content in its name under /assets, so a
// changed file always gets a new name.
const HASHED_FILES_PREFIX = '/assets/';
const CACHE_FOREVER = 'public, max-age=31536000, immutable';
// The other files keep their names from build to build, such as index.html,
// sw.js and the manifest, so the browser checks for a new copy each time.
const CHECK_FIRST = 'no-cache';
// The last segment of a path that names a file: every file name in the build
// has a ".", and no view's path does.
const FILE_NAME = /\.[^/]*$/;

/**
 * The next() that webFiles hands serveStatic. It resolves to nothing, so
 * serveStatic does too when it finds no file, and webFiles decides what
 * comes next.
 */
const noFile = () => Promise.resolve();

/**
 * Stands in for webFiles when there's no web build, so the server answers
 * /api alone. webFiles itself never takes undefined: serveStatic without a
 * root would serve files from the root of the disk.
 */
export const noWebFiles: MiddlewareHandler<RequestEnv> = (_c, next) => next();

/**
 * Serves the production web build in webDir to GET and HEAD requests: each
 * file, and index.html for any other app path, such as /wall, so a first
 * visit works before the service worker does. A missing file gets the 404
 * problem and never index.html, and nothing under /api or /media gets either.
 */
export function webFiles(webDir: string): MiddlewareHandler<RequestEnv> {
  const serveFile = serveStatic<RequestEnv>({ root: webDir });
  const serveShell = serveStatic<RequestEnv>({
    root: webDir,
    path: SHELL_FILE,
  });
  // Each header goes on the response that serveStatic returns: a c.header()
  // after serveStatic has built it reaches clients under serve() but is lost
  // under app.request().
  return createMiddleware<RequestEnv>(async (c, next) => {
    const { method, path } = c.req;
    if (!READ_METHODS.has(method) || isServerPath(path)) return next();
    const file = await serveFile(c, noFile);
    if (file instanceof Response) {
      file.headers.set(CACHE_CONTROL, cacheControlFor(path));
      return file;
    }
    // A missing file, such as an old name under /assets, gets the 404
    // problem: index.html answered in place of a script is how an installed
    // app breaks and stays broken.
    if (FILE_NAME.test(path)) return next();
    const shell = await serveShell(c, noFile);
    if (!(shell instanceof Response)) return next();
    shell.headers.set(CACHE_CONTROL, CHECK_FIRST);
    return shell;
  });
}

/** Whether a path is /api, /media or below one, which only the server's routes answer. */
function isServerPath(path: string): boolean {
  return SERVER_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Chosen by the request's path, because the file path that serveStatic works
 * with has backslashes on Windows.
 */
function cacheControlFor(path: string): string {
  return path.startsWith(HASHED_FILES_PREFIX) ? CACHE_FOREVER : CHECK_FIRST;
}
