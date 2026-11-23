import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { createApp } from './app.ts';
import { parseConfig } from './config.ts';

// Docker sends SIGKILL 10 s after SIGTERM, so shutdown has to finish first (SRV-8).
const SHUTDOWN_TIMEOUT_MS = 8_000;

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

const server = serve(
  {
    fetch: createApp().fetch,
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
    if (error) {
      log.error({ err: error }, 'server stop failed');
      process.exitCode = 1;
      return;
    }
    log.info('server stopped');
  });
}

process.once('SIGTERM', shutDown);
process.once('SIGINT', shutDown);
