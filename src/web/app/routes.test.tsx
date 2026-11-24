import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '../../shared/health.ts';
import { ApiClientContext, createApiClient } from '../data/api-client.ts';
import {
  ConnectivityContext,
  createConnectivity,
} from '../data/connectivity.ts';
import { PhoneLayout } from './PhoneLayout.tsx';
import { routes } from './routes.tsx';
import { ViewError } from './ViewError.tsx';

const TEST_ORIGIN = 'http://homehub.test';
const HEALTHY: HealthResponse = { status: 'ok', database: 'ok' };
const WALL_CARDS = ['Photos', 'Countdown', 'Groceries', 'Status'];

const answerHealthy: typeof fetch = () =>
  Promise.resolve(Response.json(HEALTHY));

function Broken(): never {
  throw new Error('broken view');
}

/** Lets pending requests answer and React render what they return. */
async function settle(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

/** Renders `path` the way main.tsx wires the app, then settles. */
async function renderRoute(
  path: string,
  { isOnline = true, routeTree = routes } = {},
) {
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
          router={createMemoryRouter(routeTree, { initialEntries: [path] })}
        />
      </ApiClientContext>
    </ConnectivityContext>,
  );
  await settle();
}

/** The first route in `tree` that `matches` picks, searched depth first. */
function findRoute(
  tree: readonly RouteObject[],
  matches: (route: RouteObject) => boolean,
): RouteObject | undefined {
  for (const route of tree) {
    if (matches(route)) return route;
    const found = findRoute(route.children ?? [], matches);
    if (found !== undefined) return found;
  }
  return undefined;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

    expect(within(card).queryByText('Server and database OK')).not.toBeNull();
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

  it('keeps the navigation when a view throws', async () => {
    // React reports the caught error to the console.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const routeTree: RouteObject[] = [
      {
        Component: PhoneLayout,
        children: [
          { index: true, Component: Broken, ErrorBoundary: ViewError },
        ],
      },
    ];

    await renderRoute('/', { routeTree });

    const navigation = screen.getByRole('navigation');
    expect({
      view: screen.getByRole('heading', { level: 1 }).textContent,
      links: within(navigation)
        .getAllByRole('link')
        .map((link) => link.textContent),
    }).toEqual({
      view: 'Something went wrong',
      links: ['Groceries', 'Photos', 'Holidays'],
    });
  });

  // A view without its own boundary would hand its error to RouteError,
  // which replaces the whole layout, navigation included (WEB-9).
  it('gives every phone view its own error boundary', () => {
    const layout = findRoute(
      routes,
      (route) => route.Component === PhoneLayout,
    );
    const views = layout?.children ?? [];

    expect({
      hasViews: views.length > 0,
      unguarded: views
        .filter((view) => !view.ErrorBoundary)
        .map((view) => view.path ?? 'the index view'),
    }).toEqual({ hasViews: true, unguarded: [] });
  });
});

describe('the offline badge', () => {
  it('shows in the phone header while the browser is offline', async () => {
    await renderRoute('/', { isOnline: false });

    const header = screen.getByRole('banner');

    expect(within(header).queryByText('Offline')).not.toBeNull();
  });

  it("shows in the wall's status card while the browser is offline", async () => {
    await renderRoute('/wall', { isOnline: false });

    const card = screen.getByRole('region', { name: 'Status' });

    expect(within(card).queryByText('Offline')).not.toBeNull();
  });
});

describe('an unknown path', () => {
  it('shows a "Page not found" heading', async () => {
    await renderRoute('/nowhere');

    const heading = screen.getByRole('heading');

    expect(heading.textContent).toBe('Page not found');
  });
});
