import { describe, expect, it } from 'vitest';
import {
  ALEX_HEADERS,
  captureLogs,
  createTestApp,
  readProblem,
} from '../test-support.ts';

const SECRET = 'secret detail from deep inside';

describe('error handling', () => {
  it('answers an unknown /api path with 401 when the request has no identity', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/no-such-route');

    expect(response.status).toBe(401);
  });

  it('answers an unknown /api path with a 404 problem when the request has an identity', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/no-such-route', {
      headers: ALEX_HEADERS,
    });

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
  });

  it('answers a thrown error with a 500 problem that has no detail, and the request ID', async () => {
    const app = await createTestApp();
    // Before the first request, because Hono builds its router then.
    app.get('/api/fail', () => {
      throw new Error(SECRET);
    });

    const response = await app.request('/api/fail', { headers: ALEX_HEADERS });

    // Compared raw, so a message, a stack or any other extra field fails.
    expect({
      status: response.status,
      body: await readProblem(response),
    }).toEqual({
      status: 500,
      body: {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        requestId: response.headers.get('X-Request-Id'),
      },
    });
  });

  it('logs a thrown error once, with the error and the request ID', async () => {
    const { log, lines } = captureLogs();
    const app = await createTestApp({ log });
    app.get('/api/fail', () => {
      throw new Error(SECRET);
    });

    const response = await app.request('/api/fail', { headers: ALEX_HEADERS });

    expect(lines).toHaveLength(2);
    expect(lines).toMatchObject([
      {
        level: 'error',
        msg: 'request failed',
        requestId: response.headers.get('X-Request-Id'),
        err: { message: SECRET },
      },
      { msg: 'request completed', status: 500 },
    ]);
  });
});
