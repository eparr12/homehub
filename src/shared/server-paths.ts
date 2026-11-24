/**
 * The paths that only the server's routes answer: the API, and the photos
 * from Phase 5. A path at or below one never gets the web app's files or its
 * index.html, from the server or from the service worker's navigation
 * fallback (WEB-12).
 */
export const SERVER_PATH_PREFIXES = ['/api', '/media'] as const;
