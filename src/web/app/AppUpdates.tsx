import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Outlet, useMatch } from 'react-router';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { WALL_PATH } from './paths.ts';

/**
 * How often an open page asks the server for a new version. An open page
 * never asks by itself, and the wall stays open for weeks.
 */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** The parts of `window` that taking a new version uses (TS-11). */
export interface BrowserPage {
  readonly navigator: {
    readonly serviceWorker: {
      /** The worker that controls the page, or null on a first visit. */
      readonly controller: object | null;
      addEventListener(
        type: 'controllerchange',
        listener: () => void,
        options: { once: true },
      ): void;
    };
  };
  readonly location: { reload(): void };
  readonly document: {
    readonly visibilityState: DocumentVisibilityState;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
  };
}

/** Hands `window` from main.tsx, or a fake from a test, to AppUpdates. */
export const BrowserPageContext = createContext<BrowserPage | null>(null);

/** Whether a new version is waiting, and how to take it. */
export interface AppUpdate {
  readonly isReady: boolean;
  readonly apply: () => void;
}

const AppUpdateContext = createContext<AppUpdate | null>(null);

/** The part of a ServiceWorkerRegistration that the checks use. */
interface Registration {
  update(): Promise<unknown>;
}

/**
 * The root route's component: it registers the service worker, asks for a
 * new version every hour and whenever the page becomes visible, takes one at
 * once on the wall, and hands it to the phone layout's prompt and to
 * LayoutError. It stays mounted when a layout below it throws, so a page that
 * shows "Something went wrong" still takes the fixed version.
 */
export function AppUpdates() {
  const page = useBrowserPage();
  const isWall = useMatch(WALL_PATH) !== null;
  const [registration, setRegistration] = useState<Registration>();
  const {
    needRefresh: [isReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registered) => {
      setRegistration(registered);
    },
    onRegisterError: (error: unknown) => {
      console.error('service worker registration failed', error);
    },
  });
  const apply = useApplyOnce(page, updateServiceWorker);
  useUpdateChecks(page.document, registration);

  // Nobody stands at the wall to tap a prompt.
  useEffect(() => {
    if (isWall && isReady) apply();
  }, [isWall, isReady, apply]);

  return (
    <AppUpdateContext value={{ isReady, apply }}>
      <Outlet />
    </AppUpdateContext>
  );
}

/** The waiting version, for the phone layout's prompt and LayoutError. */
export function useAppUpdate(): AppUpdate {
  const update = useContext(AppUpdateContext);
  if (update === null) {
    throw new Error('useAppUpdate needs AppUpdates above it');
  }
  return update;
}

function useBrowserPage(): BrowserPage {
  const page = useContext(BrowserPageContext);
  if (page === null) {
    throw new Error('AppUpdates needs a BrowserPageContext above it');
  }
  return page;
}

/**
 * applyUpdate for this page, once: on a wall that crashed, both the wall's
 * effect and LayoutError apply, and the page must reload only once.
 */
function useApplyOnce(
  page: BrowserPage,
  updateServiceWorker: () => Promise<void>,
): () => void {
  const hasAppliedRef = useRef(false);
  return useCallback(() => {
    if (hasAppliedRef.current) return;
    hasAppliedRef.current = true;
    applyUpdate(page, updateServiceWorker);
  }, [page, updateServiceWorker]);
}

/** Runs checkForUpdates once the worker is registered, until unmount. */
function useUpdateChecks(
  document: BrowserPage['document'],
  registration: Registration | undefined,
): void {
  useEffect(() => {
    if (registration === undefined) return;
    return checkForUpdates(document, registration);
  }, [document, registration]);
}

/**
 * Moves the page to the waiting version. The plugin's own reload covers only
 * a page that a worker controlled when it loaded, so this reloads every page
 * itself.
 */
function applyUpdate(
  page: BrowserPage,
  updateServiceWorker: () => Promise<void>,
): void {
  const { serviceWorker } = page.navigator;
  // Nothing controls a page from a device's first visit, because the worker
  // doesn't claim pages, so no controllerchange would come. A reload loads
  // the new worker once it's active. On the wall the reload can come before
  // that: the old worker serves it, and the page, now controlled, takes the
  // new version on controllerchange.
  if (serviceWorker.controller === null) {
    page.location.reload();
    return;
  }
  serviceWorker.addEventListener(
    'controllerchange',
    () => {
      page.location.reload();
    },
    { once: true },
  );
  // Tells the waiting worker to take over, which fires controllerchange.
  // Voided because the plugin's updateServiceWorker never rejects.
  void updateServiceWorker();
}

/**
 * Asks for a new version every hour and whenever the page becomes visible;
 * returns a function that stops asking. The plugin reports what it finds.
 */
function checkForUpdates(
  document: BrowserPage['document'],
  registration: Registration,
): () => void {
  const check = () => {
    // Voided because askForUpdate never rejects.
    void askForUpdate(registration);
  };
  const checkIfVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  const timer = setInterval(check, UPDATE_CHECK_MS);
  document.addEventListener('visibilitychange', checkIfVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', checkIfVisible);
  };
}

async function askForUpdate(registration: Registration): Promise<void> {
  try {
    await registration.update();
  } catch (error) {
    // update() rejects when the server can't be reached, as during an
    // outage. The next check asks again.
    console.warn('update check failed', error);
  }
}
