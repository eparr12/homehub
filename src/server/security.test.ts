import { describe, expect, it } from 'vitest';
import { API_BODY_LIMIT_BYTES } from './app.ts';
import { ALEX_HEADERS, createTestApp, readProblem } from './test-support.ts';

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const OTHER_ORIGIN = 'https://attacker.example';
const FORM_POST = {
  method: 'POST',
  body: 'item=eggs',
  headers: {
    ...ALEX_HEADERS,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
} as const;

/** The app with a form route, added before the first request builds the router. */
async function createAppWithForm() {
  const app = await createTestApp();
  app.post('/api/form', (c) => c.body(null, 204));
  return app;
}

describe('same-origin writes (SEC-4)', () => {
  it.each([
    {
      case: 'only a cross-site Origin header',
      headers: { Origin: OTHER_ORIGIN },
    },
    {
      case: 'Sec-Fetch-Site: cross-site',
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    },
  ])(
    'refuses a form POST with $case with a 403 problem',
    async ({ headers }) => {
      const app = await createAppWithForm();

      const response = await app.request('/api/form', {
        ...FORM_POST,
        headers: { ...FORM_POST.headers, ...headers },
      });

      expect({
        status: response.status,
        body: await readProblem(response),
      }).toEqual({
        status: 403,
        body: {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          requestId: response.headers.get('X-Request-Id'),
        },
      });
    },
  );

  it('lets a form POST with Sec-Fetch-Site: same-origin through', async () => {
    const app = await createAppWithForm();

    const response = await app.request('/api/form', {
      ...FORM_POST,
      headers: { ...FORM_POST.headers, 'Sec-Fetch-Site': 'same-origin' },
    });

    expect(response.status).toBe(204);
  });

  it.each([
    {
      case: 'an allowed request',
      path: '/api/me',
      init: { headers: { ...ALEX_HEADERS, Origin: OTHER_ORIGIN } },
    },
    {
      case: 'a preflight request',
      path: '/api/me',
      init: {
        method: 'OPTIONS',
        headers: {
          Origin: OTHER_ORIGIN,
          'Access-Control-Request-Method': 'POST',
        },
      },
    },
    {
      case: 'the health check',
      path: '/api/health',
      init: { headers: { Origin: OTHER_ORIGIN } },
    },
  ])(
    'sends no Access-Control-Allow-Origin header with $case from another origin',
    async ({ path, init }) => {
      const app = await createTestApp();

      const response = await app.request(path, init);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    },
  );
});

describe('input limits (SEC-5)', () => {
  it('answers an /api body over the limit with a 413 problem', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/me', {
      method: 'POST',
      body: 'x'.repeat(API_BODY_LIMIT_BYTES + 1),
      headers: { ...ALEX_HEADERS, 'Content-Type': 'application/json' },
    });

    expect({
      status: response.status,
      body: await readProblem(response),
    }).toEqual({
      status: 413,
      body: {
        type: 'about:blank',
        title: 'Payload Too Large',
        status: 413,
        requestId: response.headers.get('X-Request-Id'),
      },
    });
  });
});

describe('security headers (SEC-8)', () => {
  it.each([
    { case: 'the health check', path: '/api/health' },
    { case: 'a refused request', path: '/api/me' },
    { case: 'an unknown path', path: '/no-such-page' },
  ])('sends the security headers with $case', async ({ path }) => {
    const app = await createTestApp();

    const response = await app.request(path);

    expect({
      contentSecurityPolicy: response.headers.get('Content-Security-Policy'),
      contentTypeOptions: response.headers.get('X-Content-Type-Options'),
    }).toEqual({
      contentSecurityPolicy: CONTENT_SECURITY_POLICY,
      contentTypeOptions: 'nosniff',
    });
  });
});
