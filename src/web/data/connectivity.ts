import { createContext, useContext, useSyncExternalStore } from 'react';

/** The parts of `window` the store watches: the browser's verdict and its events. */
export interface BrowserNetwork {
  readonly navigator: { readonly onLine: boolean };
  addEventListener(type: 'online' | 'offline', listener: () => void): void;
}

/** Whether HomeHub is offline, for the offline badge on both layouts. */
export interface Connectivity {
  /** True when the browser reports no network or the last API request got no answer. */
  readonly isOffline: () => boolean;
  readonly subscribe: (onChange: () => void) => () => void;
  /** Wraps the API client's fetch, so each request reports whether an answer came. */
  readonly trackFetch: (fetchImpl: typeof fetch) => typeof fetch;
}

interface NetworkState {
  readonly isBrowserOnline: boolean;
  readonly hasLastRequestFailed: boolean;
}

/**
 * Creates the store that main.tsx hands to the app through
 * ConnectivityContext (TS-11). It listens for as long as the page is open.
 */
export function createConnectivity(network: BrowserNetwork): Connectivity {
  const listeners = new Set<() => void>();
  let state: NetworkState = {
    isBrowserOnline: network.navigator.onLine,
    hasLastRequestFailed: false,
  };
  const isOffline = () => !state.isBrowserOnline || state.hasLastRequestFailed;

  function update(change: Partial<NetworkState>): void {
    const wasOffline = isOffline();
    state = { ...state, ...change };
    if (isOffline() === wasOffline) return;
    for (const listener of listeners) listener();
  }

  const readBrowser = () => {
    update({ isBrowserOnline: network.navigator.onLine });
  };
  network.addEventListener('online', readBrowser);
  network.addEventListener('offline', readBrowser);

  return {
    isOffline,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    trackFetch:
      (fetchImpl) => async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          const response = await fetchImpl(input, init);
          // Any response counts, error statuses included: the server answered.
          update({ hasLastRequestFailed: false });
          return response;
        } catch (error) {
          // An aborted request was cancelled, on unmount for example, and
          // says nothing about the network.
          if (init?.signal?.aborted !== true) {
            update({ hasLastRequestFailed: true });
          }
          throw error;
        }
      },
  };
}

/** Hands the store from main.tsx (or a test) to the components (TS-11). */
export const ConnectivityContext = createContext<Connectivity | null>(null);

function useConnectivity(): Connectivity {
  const connectivity = useContext(ConnectivityContext);
  if (connectivity === null) {
    throw new Error('useIsOffline needs a ConnectivityContext above it');
  }
  return connectivity;
}

/** Whether to show the offline badge, re-rendering when that changes. */
export function useIsOffline(): boolean {
  const connectivity = useConnectivity();
  return useSyncExternalStore(connectivity.subscribe, connectivity.isOffline);
}
