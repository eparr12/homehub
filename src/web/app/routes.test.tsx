import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import type { HealthResponse } from '../../shared/health.ts';
import { ApiClientContext, createApiClient } from '../data/api-client.ts';
import { routes } from './routes.ts';

const TEST_ORIGIN = 'http://homehub.test';
const HTTP_NOT_FOUND = 404;

/** A fetch that answers GET /api/health with `health` and any other URL with 404. */
function serveHealth(health: HealthResponse): typeof fetch {
  return (input) =>
    Promise.resolve(
      input === `${TEST_ORIGIN}/api/health`
        ? Response.json(health)
        : new Response(null, { status: HTTP_NOT_FOUND }),
    );
}

const offline: typeof fetch = () =>
  Promise.reject(new TypeError('Failed to fetch'));

function renderRoute(path: string, fetchStub: typeof fetch): void {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ApiClientContext value={createApiClient(TEST_ORIGIN, fetchStub)}>
      <RouterProvider router={router} />
    </ApiClientContext>,
  );
}

describe('/wall', () => {
  it('shows the server status it reads from /api/health', async () => {
    renderRoute('/wall', serveHealth({ status: 'ok' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('Server: ok');
    });
  });

  it("says it can't reach the server when the request fails", async () => {
    renderRoute('/wall', offline);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        "Can't reach the server",
      );
    });
  });
});

describe('an unknown path', () => {
  it('shows a "Page not found" heading', async () => {
    renderRoute('/nowhere', offline);

    const heading = await screen.findByRole('heading');

    expect(heading.textContent).toBe('Page not found');
  });
});
