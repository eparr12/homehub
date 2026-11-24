import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  type BrowserNetwork,
  type Connectivity,
  ConnectivityContext,
  createConnectivity,
} from '../data/connectivity.ts';
import { OfflineBadge } from './OfflineBadge.tsx';

const HEALTH_URL = 'http://homehub.test/api/health';
const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

const noAnswer: typeof fetch = () =>
  Promise.reject(new TypeError('Failed to fetch'));

function answerWith(status: number): typeof fetch {
  return () => Promise.resolve(new Response(null, { status }));
}

/** A stand-in for window: navigator.onLine and the online and offline events. */
function createNetwork(isOnline: boolean) {
  const events = new EventTarget();
  const navigator = { onLine: isOnline };
  const network: BrowserNetwork = {
    navigator,
    addEventListener: (type, listener) => {
      events.addEventListener(type, listener);
    },
  };
  const setOnline = (value: boolean) => {
    navigator.onLine = value;
    act(() => {
      events.dispatchEvent(new Event(value ? 'online' : 'offline'));
    });
  };
  return { network, setOnline };
}

function renderBadge({ isOnline = true } = {}) {
  const { network, setOnline } = createNetwork(isOnline);
  const connectivity = createConnectivity(network);
  render(
    <ConnectivityContext value={connectivity}>
      <OfflineBadge />
    </ConnectivityContext>,
  );
  return { connectivity, setOnline };
}

/** Sends a request through the tracked fetch and waits for it to settle. */
async function send(
  connectivity: Connectivity,
  network: typeof fetch,
  init?: RequestInit,
): Promise<void> {
  await act(async () => {
    await Promise.allSettled([
      connectivity.trackFetch(network)(HEALTH_URL, init),
    ]);
  });
}

const badgeText = () => screen.getByRole('status').textContent;

describe('OfflineBadge', () => {
  it('shows nothing while the browser is online', () => {
    renderBadge();

    expect(badgeText()).toBe('');
  });

  it('shows Offline when the browser starts with no network', () => {
    renderBadge({ isOnline: false });

    expect(badgeText()).toBe('Offline');
  });

  it('shows Offline after a request that gets no answer', async () => {
    const { connectivity } = renderBadge();

    await send(connectivity, noAnswer);

    expect(badgeText()).toBe('Offline');
  });

  it('clears after the next request that gets an answer', async () => {
    const { connectivity } = renderBadge();
    await send(connectivity, noAnswer);

    await send(connectivity, answerWith(HTTP_OK));

    expect(badgeText()).toBe('');
  });

  it('counts an HTTP error status as an answer, because the server replied', async () => {
    const { connectivity } = renderBadge();
    await send(connectivity, noAnswer);

    await send(connectivity, answerWith(HTTP_SERVICE_UNAVAILABLE));

    expect(badgeText()).toBe('');
  });

  it('ignores a request that was aborted', async () => {
    const { connectivity } = renderBadge();
    const controller = new AbortController();
    controller.abort();

    await send(connectivity, noAnswer, { signal: controller.signal });

    expect(badgeText()).toBe('');
  });

  it("shows Offline on the browser's offline event", () => {
    const { setOnline } = renderBadge();

    setOnline(false);

    expect(badgeText()).toBe('Offline');
  });

  it("clears on the browser's online event", () => {
    const { setOnline } = renderBadge({ isOnline: false });

    setOnline(true);

    expect(badgeText()).toBe('');
  });
});

describe('Connectivity.trackFetch', () => {
  it('passes a failed request on to the caller', async () => {
    const connectivity = createConnectivity(createNetwork(true).network);

    const request = connectivity.trackFetch(noAnswer)(HEALTH_URL);

    await expect(request).rejects.toThrow('Failed to fetch');
  });
});
