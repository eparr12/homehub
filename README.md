# homehub
HomeHub: our family dashboard for a wall touchscreen and our phones

## Develop

You need Node.js 26.4 or newer, in the 26 line that .nvmrc names. It ships npm 11.17, and npm before 11.16 ignores package.json's `allowScripts`. Then:

```sh
npm ci           # install exactly what package-lock.json lists
npm run dev      # the server on 127.0.0.1:8080 and the app on http://localhost:5173
npm run check    # typecheck, lint, format check and unit tests
```

The phone layout is at http://localhost:5173/ and the wall layout at http://localhost:5173/wall. Vite forwards /api and /media to the server. Develop on port 5173: port 8080 serves whatever the last build left in dist/web.

The server keeps its SQLite database in data/homehub.db, and saves a backup in data/backups before each migration. The data/ folder is gitignored; set DATA_DIR to use another folder.

## Try the installable app

`npm run dev` never runs the service worker. To install HomeHub or load it offline, build it, then start the server, which serves the build:

```sh
npm run build       # the production web build into dist/web
npm run dev:server  # the server on http://127.0.0.1:8080: /api, and the build
```

The server looks for dist/web when it starts, so the build comes first; a server started before it answers /api alone until you restart it. After that, it reads the files for each request, so a new build is served without a restart. Every file goes out with the server's security headers, its Content Security Policy among them, just as in production.

The icons in src/web/public are made from icon.svg. After changing it, run `npm run icons` and commit the files it writes.

## Configure

The server reads its settings from environment variables. `npm run dev` and `npm run dev:server` load them from a .env file in the repo folder, if there is one; in production, Compose will pass them in from the host's .env (build-plan step 1.8). The repo's .env is gitignored and holds only development values (SEC-1).

| Variable | Default | What it does |
| --- | --- | --- |
| `ALLOWED_USERS` | None; the server won't start without it | The Tailscale logins that may use HomeHub, each with a short name that logs and the app show instead of the email address. Write comma-separated `login=shortname` pairs, such as `alex@example.com=alex,sam@example.com=sam`. Logins match in any letter case, and a short name is lowercase letters, digits and hyphens. |
| `NODE_ENV` | `production` | `development` or `production`. Only development allows `DEV_USER`. |
| `DEV_USER` | None | One of the logins in `ALLOWED_USERS`. In development, where no Tailscale Serve adds identity headers, a request without the Tailscale-User-Login header counts as this user. |

A .env file for development:

```sh
NODE_ENV=development
ALLOWED_USERS=alex@example.com=alex
DEV_USER=alex@example.com
```

With it, `npm run dev:server` answers http://127.0.0.1:8080/api/me with `{"shortName":"alex","displayName":"alex"}`.
