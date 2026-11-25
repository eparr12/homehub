// The server that the end-to-end tests run against, shared by
// playwright.config.ts, start-server.ts and the specs.

/**
 * The test server's own port. Never 8081, which `npm run dev` holds, or 8080,
 * which the container holds on the desktop.
 */
export const TEST_SERVER_PORT = 8181;

/** 127.0.0.1, not localhost, because the server listens on IPv4 only. */
export const TEST_SERVER_ORIGIN = `http://127.0.0.1:${String(TEST_SERVER_PORT)}`;

/** The one login on the test server's ALLOWED_USERS. */
export const TEST_LOGIN = 'playwright@example.com';

/** The short name that ALLOWED_USERS gives TEST_LOGIN. */
export const TEST_SHORT_NAME = 'playwright';

/**
 * What Tailscale Serve would add to each request from TEST_LOGIN, so the real
 * identity middleware runs (SEC-3).
 */
export const TEST_LOGIN_HEADERS = {
  'Tailscale-User-Login': TEST_LOGIN,
} as const;
