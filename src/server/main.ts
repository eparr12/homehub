import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { createApp } from './app.ts';
import { parseConfig } from './config.ts';
import { openDatabase } from './db/connection.ts';
import { MIGRATIONS_DIR, migrate } from './db/migrator.ts';
import { SHELL_FILE } from './middleware/web-files.ts';

// Docker sends SIGKILL 10 s after SIGTERM, so shutdown has to finish first (SRV-8).
const SHUTDOWN_TIMEOUT_MS = 8_000;
const DATABASE_FILE = 'homehub.db';
const BACKUPS_FOLDER = 'backups';
// Found from this file, as migrator.ts finds its migrations: dist/web beside
// src, where `npm run build` writes the web app.
const WEB_BUILD_DIR = fileURLToPath(new URL('../../dist/web', import.meta.url));

const log = pino();

// Unhandled rejections arrive here too, because Node raises them as uncaught
// exceptions. Log once and exit, so Docker restarts the container (OBS-4).
process.on('uncaughtException', (error, origin) => {
  log.fatal({ err: error, origin }, 'process failed');
  process.exit(1);
});

const config = parseConfig(process.env);
if (!config.ok) {
  log.fatal({ error: config.error }, 'invalid configuration');
  process.exit(1);
}

const { dataDir, allowedUsers, devUser, version } = config.value;
if (devUser !== undefined) {
  // The one setting that lets a request in without a Tailscale login. Logged
  // by its short name, because the login is an email address (SEC-7).
  log.info(
    { user: allowedUsers.get(devUser) },
    'DEV_USER is on: a request without a login header counts as this user',
  );
}
const backupsDir = join(dataDir, BACKUPS_FOLDER);
// recursive creates DATA_DIR too, since backups/ sits inside it.
mkdirSync(backupsDir, { recursive: true });
// On Docker Engine, a host folder that Docker creates for the backups mount
// belongs to root. The server would start and report healthy there, and its
// first backup would fail, so it stops now, through the handler above.
accessSync(backupsDir, constants.W_OK);
const db = openDatabase(join(dataDir, DATABASE_FILE));
// Before serving, so no request sees a half-migrated schema. A failure
// rejects to the uncaughtException handler above, which logs it and exits.
await migrate(db, {
  migrationsDir: MIGRATIONS_DIR,
  backupsDir,
  clock: () => Temporal.Now.instant(),
  log,
});

// Only a finished build: serveStatic logs an error for a folder that isn't
// there, and before the first build `npm run dev` serves the app from Vite.
const webDir = existsSync(join(WEB_BUILD_DIR, SHELL_FILE))
  ? WEB_BUILD_DIR
  : undefined;
if (webDir === undefined) {
  log.info('no web build in dist/web, so the server answers /api alone');
}

const server = serve(
  {
    fetch: createApp({ db, log, allowedUsers, devUser, webDir, version }).fetch,
    hostname: config.value.host,
    port: config.value.port,
  },
  (address) => {
    log.info({ host: address.address, port: address.port }, 'server listening');
  },
);

function shutDown(signal: NodeJS.Signals): void {
  log.info({ signal }, 'shutting down');
  setTimeout(() => {
    log.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'shutdown timed out');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  server.close((error) => {
    // close() fails only when the server wasn't running, so either way no
    // request can still be using the database.
    if (error) {
      log.error({ err: error }, 'server stop failed');
      process.exitCode = 1;
    } else {
      log.info('server stopped');
    }
    db.close();
    log.info('database closed');
  });
}

process.once('SIGTERM', shutDown);
process.once('SIGINT', shutDown);
