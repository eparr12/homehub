import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import type { RegisterSWOptions } from 'virtual:pwa-register/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';
import type { HealthResponse } from '../../shared/health.ts';
import { ApiClientContext, createApiClient } from '../data/api-client.ts';
import {
  ConnectivityContext,
  createConnectivity,
} from '../data/connectivity.ts';
import {
  AppUpdates,
  type BrowserPage,
  BrowserPageContext,
  UPDATE_CHECK_MS,
} from './AppUpdates.tsx';
import { WALL_PATH } from './paths.ts';
import { PhoneLayout } from './PhoneLayout.tsx';
import { routes } from './routes.tsx';
import { ViewError } from './ViewError.tsx';

const TEST_ORIGIN = 'http://homehub.test';
const HEALTHY: HealthResponse = { status: 'ok', database: 'ok' };
const WALL_CARDS = ['Photos', 'Countdown', 'Groceries', 'Status'];
const SW_URL = '/sw.js';

/** What the fake useRegisterSW below keeps, so a test can act as the plugin. */
interface FakeRegisterSW {
  options: RegisterSWOptions;
  setNeedRefresh: (isReady: boolean) => void;
  readonly updateServiceWorker: Mock<() => Promise<void>>;
}

// Under Vitest the plugin serves a stub of virtual:pwa-register/react that
// never reports a new version, so this fake replaces it: it keeps what
// AppUpdates passes in, and the helpers below act as the plugin would.
const pwa = vi.hoisted((): FakeRegisterSW => ({
  options: {},
  setNeedRefresh: () => undefined,
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}));

vi.mock(import('virtual:pwa-register/react'), async () => {
  const { useEffect, useState } = await import('react');
  return {
    useRegisterSW(options = {}) {
      const needRefresh = useState(false);
      const offlineReady = useState(false);
      const [, setNeedRefresh] = needRefresh;
      useEffect(() => {
        pwa.options = options;
        pwa.setNeedRefresh = setNeedRefresh;
      });
      return {
        needRefresh,
        offlineReady,
        updateServiceWorker: pwa.updateServiceWorker,
      };
    },
  };
});

const answerHealthy: typeof fetch = () =>
  Promise.resolve(Response.json(HEALTHY));

function Broken(): never {
  throw new Error('broken view');
}

/** Lets pending requests answer and React render what they return. */
async function settle(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

/** A stand-in for window: the service worker container, reload and visibility. */
function createFakePage({ hasController = true } = {}) {
  const controller: object | null = hasController ? {} : null;
  const serviceWorker = Object.assign(new EventTarget(), { controller });
  const visibility: { visibilityState: DocumentVisibilityState } = {
    visibilityState: 'visible',
  };
  const fakeDocument = Object.assign(new EventTarget(), visibility);
  const reload = vi.fn();
  const page: BrowserPage = {
    navigator: { serviceWorker },
    location: { reload },
    document: fakeDocument,
  };
  return {
    page,
    reload,
    /** What the browser does once the new worker controls the page. */
    takeControl: () => {
      serviceWorker.dispatchEvent(new Event('controllerchange'));
    },
    setVisibility: (state: DocumentVisibilityState) => {
      fakeDocument.visibilityState = state;
      fakeDocument.dispatchEvent(new Event('visibilitychange'));
    },
  };
}

/** Renders `path` the way main.tsx wires the app, then settles. */
async function renderRoute(
  path: string,
  { isOnline = true, routeTree = routes, page = createFakePage().page } = {},
) {
  const connectivity = createConnectivity({
    navigator: { onLine: isOnline },
    addEventListener: () => undefined,
  });
  const client = createApiClient(
    TEST_ORIGIN,
    connectivity.trackFetch(answerHealthy),
  );
  const view = render(
    <BrowserPageContext value={page}>
      <ConnectivityContext value={connectivity}>
        <ApiClientContext value={client}>
          <RouterProvider
            router={createMemoryRouter(routeTree, { initialEntries: [path] })}
          />
        </ApiClientContext>
      </ConnectivityContext>
    </BrowserPageContext>,
  );
  await settle();
  return view;
}

/** What the plugin does when it finds a new worker waiting. */
function reportNewVersion(): void {
  act(() => {
    pwa.setNeedRefresh(true);
    pwa.options.onNeedRefresh?.();
  });
}

/** What the plugin does once the browser has registered the worker. */
function finishRegistration(registration: {
  update: () => Promise<unknown>;
}): void {
  act(() => {
    // AppUpdates uses only update().
    pwa.options.onRegisteredSW?.(
      SW_URL,
      registration as unknown as ServiceWorkerRegistration,
    );
  });
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

/** `tree` with the route that `matches` picks swapped for one that throws. */
function withBrokenRoute(
  matches: (route: RouteObject) => boolean,
  tree: readonly RouteObject[] = routes,
): RouteObject[] {
  return tree.map((route): RouteObject => {
    if (route.index === true) return route;
    if (matches(route)) return { ...route, Component: Broken };
    if (route.children === undefined) return route;
    return { ...route, children: withBrokenRoute(matches, route.children) };
  });
}

const isWallRoute = (route: RouteObject) => route.path === WALL_PATH;
const isPhoneLayout = (route: RouteObject) => route.Component === PhoneLayout;

const reloadButton = () => screen.queryByRole('button', { name: 'Reload' });

/** The phone layout's live region below the header, which holds the prompt. */
function promptRegion(): HTMLElement | undefined {
  const header = screen.getByRole('banner');
  return screen
    .getAllByRole('status')
    .find((region) => !header.contains(region));
}

beforeEach(() => {
  vi.useFakeTimers();
  pwa.updateServiceWorker.mockClear();
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
        // The layout's update prompt reads what AppUpdates provides.
        Component: AppUpdates,
        children: [
          {
            Component: PhoneLayout,
            children: [
              { index: true, Component: Broken, ErrorBoundary: ViewError },
            ],
          },
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

describe('a new version', () => {
  it('shows the Reload prompt on the phone only once one is ready', async () => {
    const fake = createFakePage();
    await renderRoute('/', { page: fake.page });
    const hadPrompt = reloadButton() !== null;

    reportNewVersion();

    expect({
      hadPrompt,
      hasPrompt: reloadButton() !== null,
      // The old version keeps running until Reload is tapped.
      toldWorker: pwa.updateServiceWorker.mock.calls.length,
      reloads: fake.reload.mock.calls.length,
    }).toEqual({
      hadPrompt: false,
      hasPrompt: true,
      toldWorker: 0,
      reloads: 0,
    });
  });

  it('reloads the phone after Reload, once the new worker takes control', async () => {
    const fake = createFakePage();
    await renderRoute('/', { page: fake.page });
    reportNewVersion();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    const reloadsBeforeControl = fake.reload.mock.calls.length;
    fake.takeControl();

    expect({
      toldWorker: pwa.updateServiceWorker.mock.calls.length,
      reloadsBeforeControl,
      reloads: fake.reload.mock.calls.length,
    }).toEqual({ toldWorker: 1, reloadsBeforeControl: 0, reloads: 1 });
  });

  // Nothing controls a page from a device's first visit, so no
  // controllerchange would come.
  it('reloads at once after Reload when no worker controls the page', async () => {
    const fake = createFakePage({ hasController: false });
    await renderRoute('/', { page: fake.page });
    reportNewVersion();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(fake.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads the wall without a prompt, once the new worker takes control', async () => {
    const fake = createFakePage();
    await renderRoute(WALL_PATH, { page: fake.page });

    reportNewVersion();
    fake.takeControl();

    expect({
      hasPrompt: reloadButton() !== null,
      reloads: fake.reload.mock.calls.length,
    }).toEqual({ hasPrompt: false, reloads: 1 });
  });

  it('announces the prompt from a live region that was already in the page', async () => {
    await renderRoute('/');
    const region = promptRegion();
    const textBefore = region?.textContent;

    reportNewVersion();

    expect({
      textBefore,
      isSameRegion: promptRegion() === region,
      holdsReload:
        region !== undefined &&
        within(region).queryByRole('button', { name: 'Reload' }) !== null,
    }).toEqual({ textBefore: '', isSameRegion: true, holdsReload: true });
  });

  // Both the wall's own effect and the error page take the new version, and
  // the page reloads once.
  it('still reloads the wall once after the wall page throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = createFakePage();
    await renderRoute(WALL_PATH, {
      page: fake.page,
      routeTree: withBrokenRoute(isWallRoute),
    });

    reportNewVersion();
    fake.takeControl();

    expect({
      heading: screen.getByRole('heading').textContent,
      reloads: fake.reload.mock.calls.length,
    }).toEqual({ heading: 'Something went wrong', reloads: 1 });
  });

  // The error page replaces the layout and its prompt, and a broken page has
  // nothing to keep.
  it('reloads the phone without a prompt after its layout throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fake = createFakePage();
    await renderRoute('/', {
      page: fake.page,
      routeTree: withBrokenRoute(isPhoneLayout),
    });

    reportNewVersion();
    fake.takeControl();

    expect({
      heading: screen.getByRole('heading').textContent,
      reloads: fake.reload.mock.calls.length,
    }).toEqual({ heading: 'Something went wrong', reloads: 1 });
  });

  it('logs a registration that fails', async () => {
    const logError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failure = new TypeError('Failed to register a ServiceWorker');
    await renderRoute('/');

    act(() => {
      pwa.options.onRegisterError?.(failure);
    });

    expect(logError).toHaveBeenCalledWith(
      'service worker registration failed',
      failure,
    );
  });

  it('asks the server for one every hour', async () => {
    const registration = { update: vi.fn(() => Promise.resolve()) };
    await renderRoute(WALL_PATH);
    finishRegistration(registration);

    await act(() => vi.advanceTimersByTimeAsync(2 * UPDATE_CHECK_MS));

    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it('asks the server for one when the page becomes visible, not when it hides', async () => {
    const fake = createFakePage();
    const registration = { update: vi.fn(() => Promise.resolve()) };
    await renderRoute('/', { page: fake.page });
    finishRegistration(registration);

    fake.setVisibility('hidden');
    fake.setVisibility('visible');

    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('keeps asking after a check that gets no answer, and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const registration = {
      update: vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new TypeError('Failed to update'))
        .mockResolvedValue(undefined),
    };
    await renderRoute(WALL_PATH);
    finishRegistration(registration);

    await act(() => vi.advanceTimersByTimeAsync(2 * UPDATE_CHECK_MS));

    expect({
      checks: registration.update.mock.calls.length,
      warnings: warn.mock.calls.length,
    }).toEqual({ checks: 2, warnings: 1 });
  });

  it('stops asking once it unmounts', async () => {
    const fake = createFakePage();
    const registration = { update: vi.fn(() => Promise.resolve()) };
    const { unmount } = await renderRoute(WALL_PATH, { page: fake.page });
    finishRegistration(registration);

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(UPDATE_CHECK_MS));
    fake.setVisibility('hidden');
    fake.setVisibility('visible');

    expect(registration.update).not.toHaveBeenCalled();
  });
});
