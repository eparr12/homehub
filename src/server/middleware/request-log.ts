import type { HonoRequest } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { RequestIdVariables } from 'hono/request-id';
import type { Logger } from 'pino';
import { HEALTH_PATH } from '../../shared/health.ts';

const COMPLETED = 'request completed';

/** What every request carries: its ID, and the logger for its lines (OBS-5). */
export interface RequestEnv {
  Variables: RequestIdVariables & {
    /** Carries the request ID and, once identity knows it, the short name. */
    log: Logger;
  };
}

/**
 * Gives each request a child logger that carries its ID, for every line the
 * request logs, then logs one line when the request completes (OBS-1, OBS-5).
 */
export function requestLog(log: Logger) {
  return createMiddleware<RequestEnv>(async (c, next) => {
    // A duration needs a monotonic timer, and TS-8 is about the wall clock.
    const start = performance.now();
    c.set('log', log.child({ requestId: c.get('requestId') }));
    await next();
    const line = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: performance.now() - start,
    };
    if (isHealthCheck(c.req)) {
      c.get('log').debug(line, COMPLETED);
    } else {
      c.get('log').info(line, COMPLETED);
    }
  });
}

// Docker calls the health check every 30 seconds (build-plan step 1.8), so its
// line is detail for troubleshooting, not a key event (OBS-2).
function isHealthCheck(request: HonoRequest): boolean {
  return request.method === 'GET' && request.path === HEALTH_PATH;
}
