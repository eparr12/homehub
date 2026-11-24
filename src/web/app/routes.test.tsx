import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '../../shared/health.ts';
import { ApiClientContext, createApiClient } from '../data/api-client.ts';
import {
  ConnectivityContext,
  createConnectivity,
} from '../data/connectivity.ts';
import { routes } from './routes.tsx';

const TEST_ORIGIN = 'http://homehub.test';
const HEALTHY: HealthResponse = { status: 'ok', database: 'ok' };
const WALL_CARDS = ['Photos', 'Countdown', 'Groceries', 'Status'];

const answerHealthy: typeof fetch = () =>
  Promise.resolve(Response.json(HEALTHY));

/** Lets pending requests answer and React render what they return. */
async function settle(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

/** Renders `path` the way main.tsx wires the app, then settles. */
async function renderRoute(path: string, { isOnline = true } = {}) {
  const connectivity = createConnectivity({
    navigator: { onLine: isOnline },
    addEventListener: () => undefined,
  });
  const client = createApiClient(
    TEST_ORIGIN,
    connectivity.trackFetch(answerHealthy),
  );
  render(
    <ConnectivityContext value={connectivity}>
      <ApiClientContext value={client}>
        <RouterProvider
          router={createMemoryRouter(routes, { initialEntries: [path] })}
        />
      </ApiClientContext>
    </ConnectivityContext>,
  );
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('/wall', () => {
  it('shows the photos, countdown, groceries and status cards, and the first three open', async () => {
    await renderRoute('/wall');

    expect({
      cards: screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
      opening: WALL_CARDS.filter(
        (name) => screen.queryByRole('button', { name }) !== null,
      ),
    }).toEqual({
      cards: WALL_CARDS,
      opening: ['Photos', 'Countdown', 'Groceries'],
    });
  });

  it('shows the status it reads from /api/health on the status card', async () => {
    await renderRoute('/wall');

    const card = screen.getByRole('region', { name: 'Status' });

    expect(within(card).getByRole('status').textContent).toBe(
      'Server and database OK',
    );
  });
});

describe('the phone layout', () => {
  it('switches views from the bottom navigation and marks the current one', async () => {
    await renderRoute('/');

    fireEvent.click(screen.getByRole('link', { name: 'Photos' }));
    await settle();

    expect({
      view: screen.getByRole('heading', { level: 1 }).textContent,
      current: screen.getByRole('link', { current: 'page' }).textContent,
    }).toEqual({ view: 'Photos', current: 'Photos' });
  });

  it('links to the wall layout', async () => {
    await renderRoute('/');

    const link = screen.getByRole('link', { name: 'Wall' });

    expect(link.getAttribute('href')).toBe('/wall');
  });
});

describe('the offline badge', () => {
  it.each(['/', '/wall'])(
    'shows on %s while the browser is offline',
    async (path) => {
      await renderRoute(path, { isOnline: false });

      expect(screen.queryByText('Offline')).not.toBeNull();
    },
  );
});

describe('an unknown path', () => {
  it('shows a "Page not found" heading', async () => {
    await renderRoute('/nowhere');

    const heading = screen.getByRole('heading');

    expect(heading.textContent).toBe('Page not found');
  });
});
