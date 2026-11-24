import { describe, expect, it } from 'vitest';
import { captureLogs, createTestApp, readProblem } from '../test-support.ts';

// The identity headers that Tailscale Serve adds to each tailnet request.
const LOGIN = 'Tailscale-User-Login';
const NAME = 'Tailscale-User-Name';

describe('identity', () => {
  it('refuses a request without a login header with a 401 problem', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/me');

    expect({
      status: response.status,
      body: await readProblem(response),
    }).toEqual({
      status: 401,
      body: {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: 'The request has no Tailscale identity on the allowed list.',
        requestId: response.headers.get('X-Request-Id'),
      },
    });
  });

  it('refuses a login that is not on ALLOWED_USERS', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/me', {
      headers: { [LOGIN]: 'stranger@example.com' },
    });

    expect(response.status).toBe(401);
  });

  it.each(['constructor', '__proto__'])(
    'refuses the login %s, which a plain object would inherit',
    async (login) => {
      const app = await createTestApp();

      const response = await app.request('/api/me', {
        headers: { [LOGIN]: login },
      });

      expect(response.status).toBe(401);
    },
  );

  it('refuses a login that is not on ALLOWED_USERS even when DEV_USER is set', async () => {
    const app = await createTestApp({ devUser: 'alex@example.com' });

    const response = await app.request('/api/me', {
      headers: { [LOGIN]: 'stranger@example.com' },
    });

    expect(response.status).toBe(401);
  });

  it('accepts an allowed login in any case', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/me', {
      headers: { [LOGIN]: 'Alex@Example.COM' },
    });

    expect(await response.json()).toEqual({
      shortName: 'alex',
      displayName: 'alex',
    });
  });

  it('answers a request without a login header as DEV_USER when DEV_USER is set', async () => {
    const app = await createTestApp({ devUser: 'alex@example.com' });

    const response = await app.request('/api/me');

    expect(await response.json()).toEqual({
      shortName: 'alex',
      displayName: 'alex',
    });
  });

  it.each([
    { case: 'missing', headers: { [LOGIN]: 'alex@example.com' } },
    { case: 'empty', headers: { [LOGIN]: 'alex@example.com', [NAME]: '' } },
  ])(
    'uses the short name as the display name when the name header is $case',
    async ({ headers }) => {
      const app = await createTestApp();

      const response = await app.request('/api/me', { headers });

      expect(await response.json()).toEqual({
        shortName: 'alex',
        displayName: 'alex',
      });
    },
  );

  // Serve sends a non-ASCII value as RFC 2047 encoded words, and splits a long
  // one into several words with a space between them that isn't part of the
  // value (RFC 2047, section 6.2).
  it.each([
    { case: 'one encoded word', name: '=?utf-8?q?Ferris_B=C3=BCller?=' },
    {
      case: 'adjacent encoded words',
      name: '=?utf-8?q?Ferris_?= =?utf-8?q?B=C3=BCller?=',
    },
    {
      case: 'an encoded word in other letter cases',
      name: '=?UTF-8?Q?Ferris_B=c3=bcller?=',
    },
  ])('decodes a display name sent as $case', async ({ name }) => {
    const app = await createTestApp();

    const response = await app.request('/api/me', {
      headers: { [LOGIN]: 'alex@example.com', [NAME]: name },
    });

    expect(await response.json()).toEqual({
      shortName: 'alex',
      displayName: 'Ferris Büller',
    });
  });

  it('decodes an encoded login before looking it up', async () => {
    const app = await createTestApp();

    const response = await app.request('/api/me', {
      headers: { [LOGIN]: '=?utf-8?q?zo=C3=AB@example.com?=' },
    });

    expect(await response.json()).toEqual({
      shortName: 'zoe',
      displayName: 'zoe',
    });
  });

  // The reason only, because a login is an email address (SEC-7).
  it.each([
    { reason: 'login header missing', headers: {} },
    {
      reason: 'login not on ALLOWED_USERS',
      headers: { [LOGIN]: 'stranger@example.com' },
    },
  ])(
    'logs a refusal as "$reason", without the login',
    async ({ reason, headers }) => {
      const { log, lines } = captureLogs();
      const app = await createTestApp({ log });

      const response = await app.request('/api/me', { headers });

      expect(lines[0]).toEqual({
        level: 'warn',
        requestId: response.headers.get('X-Request-Id'),
        reason,
        msg: 'request refused',
      });
    },
  );
});
