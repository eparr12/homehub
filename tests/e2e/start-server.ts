// Starts the real server for Playwright's webServer, after `npm run build`:
// in production mode, on its own port, with only the test login allowed and
// a data folder that's new for each run (TEST-8).
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TEST_LOGIN,
  TEST_SERVER_PORT,
  TEST_SHORT_NAME,
} from './test-server.ts';

// Named here, from this file's own location, and never read from the
// environment or an argument, so nothing can point the delete below at data/
// or anywhere else. It's gitignored, and outside test-results/, which
// Playwright empties at the start of every run.
const DATA_DIR = fileURLToPath(new URL('../../e2e-data', import.meta.url));
// Windows can still hold a file of the server that the last run killed, and
// rmSync retries that with a linear backoff of 100 ms.
const DELETE_RETRIES = 5;

// Deleted at the start of a run, because nothing can at the end: Playwright
// kills the server's process tree outright, with taskkill /T /F on Windows,
// and globalTeardown runs while the server still has the database open.
rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: DELETE_RETRIES });

process.env.NODE_ENV = 'production';
process.env.DATA_DIR = DATA_DIR;
process.env.PORT = String(TEST_SERVER_PORT);
process.env.ALLOWED_USERS = `${TEST_LOGIN}=${TEST_SHORT_NAME}`;
// Whatever the shell holds, no request gets in without the login header
// (SEC-3), the server keeps its loopback default (SEC-2), and it reports
// version dev. With these three gone, the launcher decides every variable
// that config.ts reads.
delete process.env.DEV_USER;
delete process.env.HOST;
delete process.env.GIT_SHA;

// Only now, because main.ts reads process.env as it loads.
await import('../../src/server/main.ts');
