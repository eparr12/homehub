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
  },
  server: {
    proxy: {
      '/api': DEV_SERVER_ORIGIN,
      '/media': DEV_SERVER_ORIGIN,
    },
  },
});
