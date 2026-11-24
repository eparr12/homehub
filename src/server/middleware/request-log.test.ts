import { describe, expect, it } from 'vitest';
import {
  ALEX_HEADERS,
  ANY_NUMBER,
  captureLogs,
  createTestApp,
} from '../test-support.ts';

describe('request log', () => {
  it('logs one line per request with the method, the path without its query, the status, the duration and the short name', async () => {
    const { log, lines } = captureLogs();
    const app = await createTestApp({ log });

    const response = await app.request('/api/me?fields=all', {
      headers: ALEX_HEADERS,
    });

    expect(lines).toEqual([
      {
        level: 'info',
        requestId: response.headers.get('X-Request-Id'),
        user: 'alex',
        method: 'GET',
        path: '/api/me',
        status: 200,
        durationMs: ANY_NUMBER,
        msg: 'request completed',
      },
    ]);
  });

  // Docker calls the health check every 30 seconds (build-plan step 1.8).
  it('logs the health check at debug, with its request ID', async () => {
    const { log, lines } = captureLogs('debug');
    const app = await createTestApp({ log });

    const response = await app.request('/api/health');

    expect(lines).toEqual([
      {
        level: 'debug',
        requestId: response.headers.get('X-Request-Id'),
        method: 'GET',
        path: '/api/health',
        status: 200,
        durationMs: ANY_NUMBER,
        msg: 'request completed',
      },
    ]);
  });

  it('puts the request ID on every line that a request logs', async () => {
    const { log, lines } = captureLogs();
    const app = await createTestApp({ log });

    const response = await app.request('/api/me');

    const requestId = response.headers.get('X-Request-Id');
    expect(lines).toEqual([
      expect.objectContaining({ msg: 'request refused', requestId }),
      expect.objectContaining({ msg: 'request completed', requestId }),
    ]);
  });

  it('keeps email addresses out of every line, for an allowed request and a refused one', async () => {
    const { log, lines } = captureLogs('debug');
    const app = await createTestApp({ log });

    await app.request('/api/me', { headers: ALEX_HEADERS });
    await app.request('/api/me', {
      headers: { 'Tailscale-User-Login': 'stranger@example.com' },
    });

    expect(lines).toHaveLength(3);
    expect(lines.filter((line) => JSON.stringify(line).includes('@'))).toEqual(
      [],
    );
  });
});
