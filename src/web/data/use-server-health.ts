import { useEffect, useState } from 'react';
import type { HealthResponse } from '../../shared/health.ts';
import { type ApiClient, useApiClient } from './api-client.ts';

/** What the web app knows about the server's health. */
export type ServerHealth =
  | { readonly state: 'checking' }
  | { readonly state: 'ok'; readonly response: HealthResponse }
  | { readonly state: 'unreachable' };

/** Reads GET /api/health once, when the calling component mounts. */
export function useServerHealth(): ServerHealth {
  const client = useApiClient();
  const [health, setHealth] = useState<ServerHealth>({ state: 'checking' });

  useEffect(() => {
    const controller = new AbortController();
    // Voided because an effect can't await; readServerHealth never rejects,
    // and the abort check drops a result that arrives after unmount.
    void readServerHealth(client, controller.signal).then((result) => {
      if (!controller.signal.aborted) setHealth(result);
    });
    return () => {
      controller.abort();
    };
  }, [client]);

  return health;
}

async function readServerHealth(
  client: ApiClient,
  signal: AbortSignal,
): Promise<ServerHealth> {
  try {
    const response = await client.api.health.$get(undefined, {
      init: { signal },
    });
    if (!response.ok) return { state: 'unreachable' };
    return { state: 'ok', response: await response.json() };
  } catch {
    // fetch rejects when the network is down or the request was aborted, and
    // json() when a proxy answers with something else: no answer either way.
    return { state: 'unreachable' };
  }
}
