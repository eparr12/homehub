import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { SERVER_PATH_PREFIXES } from './src/shared/server-paths.ts';
import { WALL_PATH } from './src/web/app/paths.ts';

/** Where `npm run dev:server` listens: config.ts's default HOST and PORT. */
const DEV_SERVER_ORIGIN = 'http://127.0.0.1:8081';
const THEMES_FILE = fileURLToPath(
  new URL('src/web/styles/themes.css', import.meta.url),
);
const DEFAULT_THEME = /\[data-theme='default'\]\s*\{([^}]*)\}/;
const SURFACE_TOKEN = /--surface\s*:\s*(#[\da-f]{6})\s*;/i;
// Navigations that go to the server, never to the cached app shell (WEB-12).
// The worker tests the path and the query string, so /api?x must match too.
const SERVER_PATHS = SERVER_PATH_PREFIXES.map(
  (prefix) => new RegExp(`^${RegExp.escape(prefix)}(?:[/?]|$)`),
);

/**
 * The default theme's --surface, for the web manifest, so that themes.css
 * stays the only file that names a color (WEB-5).
 */
function readDefaultSurface(): string {
  const theme =
    DEFAULT_THEME.exec(readFileSync(THEMES_FILE, 'utf8'))?.[1] ?? '';
  const surface = SURFACE_TOKEN.exec(theme)?.[1];
  if (surface === undefined) {
    throw new Error(
      `The web manifest needs --surface from the default theme in ${THEMES_FILE}, and it isn't there.`,
    );
  }
  return surface;
}

const DEFAULT_SURFACE = readDefaultSurface();

export default defineConfig({
  root: fileURLToPath(new URL('src/web', import.meta.url)),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Phones show a prompt; AppUpdates takes a new version at once on the
      // wall.
      registerType: 'prompt',
      // AppUpdates registers the worker through virtual:pwa-register/react,
      // so nothing goes into index.html, where the Content Security Policy
      // blocks inline scripts (SEC-8).
      injectRegister: false,
      // The icons that index.html links. The manifest's own are precached
      // anyway.
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'HomeHub',
        short_name: 'HomeHub',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: DEFAULT_SURFACE,
        background_color: DEFAULT_SURFACE,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [{ name: 'Wall display', url: WALL_PATH }],
      },
      // The app shell and no runtime caching: Dexie is the offline store, so
      // /api is never cached, and step 5.3 adds the /media image cache.
      workbox: { navigateFallbackDenylist: SERVER_PATHS },
    }),
  ],
  build: {
    outDir: fileURLToPath(new URL('dist/web', import.meta.url)),
    emptyOutDir: true,
    // Vite inlines small assets as data: URLs, which the server's Content
    // Security Policy blocks (SEC-8).
    assetsInlineLimit: 0,
    // One app chunk on purpose: HomeHub loads once and stays open, the wall
    // for weeks, so splitting the code would add requests and save nothing.
    // The PWA plugin loads workbox-window as a second chunk of 6 kB. Motion
    // and Zod take the app past Vite's 500 kB default (557 kB, 176 kB
    // gzipped); this limit still warns about an unexpected jump.
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: Object.fromEntries(
      SERVER_PATH_PREFIXES.map((prefix) => [prefix, DEV_SERVER_ORIGIN]),
    ),
  },
});
