# homehub
HomeHub: our family dashboard for a wall touchscreen and our phones

## Develop

You need Node.js 26 (the version in .nvmrc). Then:

```sh
npm ci           # install exactly what package-lock.json lists
npm run dev      # the API on 127.0.0.1:8080 and the app on http://localhost:5173
npm run check    # typecheck, lint, format check and unit tests
```

The phone layout is at http://localhost:5173/ and the wall layout at http://localhost:5173/wall. Vite forwards /api and /media to the API server.
