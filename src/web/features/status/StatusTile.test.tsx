import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '../../../shared/health.ts';
import { ApiClientContext, createApiClient } from '../../data/api-client.ts';
import { HEALTH_REFRESH_MS } from '../../data/use-server-health.ts';
import { StatusTile } from './StatusTile.tsx';

const TEST_ORIGIN = 'http://homehub.test';
const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HEALTHY: HealthResponse = { status: 'ok', database: 'ok' };
const DATABASE_FAILED: HealthResponse = { status: 'error', database: 'error' };
const CHECKING_TEXT = 'Checking the server…';
const OK_TEXT = 'Server and database OK';
const DATABASE_FAILED_TEXT = 'Server is up, but its database check failed';
const UNREACHABLE_TEXT = "Can't reach the server";

const answerHealthy: typeof fetch = () =>
  Promise.resolve(Response.json(HEALTHY));
const answerDatabaseFailed: typeof fetch = () =>
  Promise.resolve(
    Response.json(DATABASE_FAILED, { status: HTTP_SERVICE_UNAVAILABLE }),
  );
const neverAnswer: typeof fetch = () => new Promise<Response>(() => undefined);
const noAnswer: typeof fetch = () =>
  Promise.reject(new TypeError('Failed to fetch'));
const proxyErrorPage: typeof fetch = () =>
  Promise.resolve(
    new Response('<h1>502 Bad Gateway</h1>', {
      status: HTTP_BAD_GATEWAY,
      headers: { 'Content-Type': 'text/html' },
    }),
  );

function renderTile(network: typeof fetch): void {
  render(
    <ApiClientContext value={createApiClient(TEST_ORIGIN, network)}>
      <StatusTile />
    </ApiClientContext>,
  );
}

/** Lets pending requests answer and timers due within `ms` fire. */
async function advance(ms = 0): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

const statusText = () => screen.getByRole('status').textContent;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StatusTile', () => {
  it('says it is checking until the server answers', async () => {
    renderTile(neverAnswer);

    await advance();

    expect(statusText()).toBe(CHECKING_TEXT);
  });

  it('shows the server and database OK', async () => {
    renderTile(answerHealthy);

    await advance();

    expect(statusText()).toBe(OK_TEXT);
  });

  it('shows a failed database check when the server answers 503', async () => {
    renderTile(answerDatabaseFailed);

    await advance();

    expect(statusText()).toBe(DATABASE_FAILED_TEXT);
  });

  it.each([
    { case: 'the request gets no answer', network: noAnswer },
    { case: 'a proxy answers with its error page', network: proxyErrorPage },
  ])("says it can't reach the server when $case", async ({ network }) => {
    renderTile(network);

    await advance();

    expect(statusText()).toBe(UNREACHABLE_TEXT);
  });

  it('reads /api/health again 60 seconds after each answer', async () => {
    let network = answerHealthy;
    renderTile((input, init) => network(input, init));
    await advance();
    network = answerDatabaseFailed;

    await advance(HEALTH_REFRESH_MS - 1);
    const beforeRefresh = statusText();
    await advance(1);

    expect([beforeRefresh, statusText()]).toEqual([
      OK_TEXT,
      DATABASE_FAILED_TEXT,
    ]);
  });
});
