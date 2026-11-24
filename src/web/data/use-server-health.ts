import { useEffect, useState } from 'react';
import {
  type HealthResponse,
  healthResponseSchema,
} from '../../shared/health.ts';
import { type ApiClient, useApiClient } from './api-client.ts';

/**
 * How long after each answer the wall reads GET /api/health again. The wall
 * stays open for weeks, and a later request is what clears the offline badge.
 */
export const HEALTH_REFRESH_MS = 60_000;

/** What the web app knows about the server's health. */
export type ServerHealth =
  | { readonly state: 'checking' }
  | { readonly state: 'answered'; readonly report: HealthResponse }
  | { readonly state: 'unreachable' };

const CHECKING: ServerHealth = { state: 'checking' };
const UNREACHABLE: ServerHealth = { state: 'unreachable' };

/** Reads GET /api/health on mount and HEALTH_REFRESH_MS after each answer. */
export function useServerHealth(): ServerHealth {
  const client = useApiClient();
  const [health, setHealth] = useState<ServerHealth>(CHECKING);

  useEffect(() => {
    const controller = new AbortController();
    let nextRead: ReturnType<typeof setTimeout> | undefined;

    async function readAndReschedule(): Promise<void> {
      const result = await readServerHealth(client, controller.signal);
      // Unmounted: the request was aborted, so its result is dropped.
      if (controller.signal.aborted) return;
      setHealth(result);
      nextRead = setTimeout(() => {
        void readAndReschedule();
      }, HEALTH_REFRESH_MS);
    }

    // Voided because neither an effect nor a timer can await;
    // readAndReschedule never rejects.
    void readAndReschedule();
    return () => {
      controller.abort();
      clearTimeout(nextRead);
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
    // The server answers 503 with the same body when its database check
    // fails, so the body decides. A proxy's error page fails the schema
    // (TS-5).
    const body = healthResponseSchema.safeParse(await response.json());
    return body.success
      ? { state: 'answered', report: body.data }
      : UNREACHABLE;
  } catch {
    // fetch rejects when the network is down or the request was aborted, and
    // json() when the body isn't JSON: no answer from HomeHub either way.
    return UNREACHABLE;
  }
}
