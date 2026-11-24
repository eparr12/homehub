import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Where `npm run dev:server` listens: config.ts's default HOST and PORT. */
const DEV_SERVER_ORIGIN = 'http://127.0.0.1:8080';

export default defineConfig({
  root: fileURLToPath(new URL('src/web', import.meta.url)),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL('dist/web', import.meta.url)),
    emptyOutDir: true,
    // Vite inlines small assets as data: URLs, which the server's Content
    // Security Policy blocks (SEC-8).
    assetsInlineLimit: 0,
    // One chunk on purpose: HomeHub loads once and stays open, the wall for
    // weeks, so splitting the code would add requests and save nothing.
    // Motion and Zod take it past Vite's 500 kB default (534 kB, 170 kB
    // gzipped); this limit still warns about an unexpected jump.
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': DEV_SERVER_ORIGIN,
      '/media': DEV_SERVER_ORIGIN,
    },
  },
});
