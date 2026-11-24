import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { createApp } from './app.ts';
import { parseConfig } from './config.ts';
import { openDatabase } from './db/connection.ts';
import { MIGRATIONS_DIR, migrate } from './db/migrator.ts';

// Docker sends SIGKILL 10 s after SIGTERM, so shutdown has to finish first (SRV-8).
const SHUTDOWN_TIMEOUT_MS = 8_000;
const DATABASE_FILE = 'homehub.db';
const BACKUPS_FOLDER = 'backups';

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

const { dataDir } = config.value;
const backupsDir = join(dataDir, BACKUPS_FOLDER);
// recursive creates DATA_DIR too, since backups/ sits inside it.
mkdirSync(backupsDir, { recursive: true });
const db = openDatabase(join(dataDir, DATABASE_FILE));
// Before serving, so no request sees a half-migrated schema. A failure
// rejects to the uncaughtException handler above, which logs it and exits.
await migrate(db, {
  migrationsDir: MIGRATIONS_DIR,
  backupsDir,
  clock: () => Temporal.Now.instant(),
  log,
});

const server = serve(
  {
    fetch: createApp({ db, log }).fetch,
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
