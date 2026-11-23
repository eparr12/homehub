import { hc } from 'hono/client';
import { createContext, useContext } from 'react';
import type { AppType } from '../../server/app.ts';

/** The typed client for HomeHub's API, built from the server's routes (SRV-3). */
export type ApiClient = ReturnType<typeof hc<AppType>>;

/** Creates the client for the server at `origin`; tests pass a stub `fetchImpl`. */
export function createApiClient(
  origin: string,
  fetchImpl?: typeof fetch,
): ApiClient {
  return hc<AppType>(origin, { fetch: fetchImpl });
}

/** Hands the client from main.tsx (or a test) to the data hooks (TS-11). */
export const ApiClientContext = createContext<ApiClient | null>(null);

/** Returns the client from the nearest ApiClientContext. */
export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (client === null) {
    throw new Error('useApiClient needs an ApiClientContext above it');
  }
  return client;
}
