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

## Run the end-to-end tests

Playwright runs the production build in three projects: wall (Chromium at 1920 by 1080), iphone (WebKit, as an iPhone 17) and android (Chromium, as a Pixel 10). Download its browsers once, and again after an update to Playwright; they go to a folder outside the repo:

```sh
npx playwright install chromium webkit
```

Then:

```sh
npm run e2e                  # build, start a test server on 127.0.0.1:8181 and run every project
npx playwright show-report   # open the last run's report, from playwright-report/
```

The test server is the real one in production mode, with a new e2e-data/ folder for each run and a made-up login as its only allowed user, so it never touches data/. It needs port 8181 free. To run one project, add its name: `npm run e2e -- --project=iphone`.

## Continuous integration

GitHub Actions runs .github/workflows/ci.yml on every pull request and every push to main. A pull request merges only when both of its jobs pass:

- **check**: `npm ci`, `npm run check`, which prints a coverage table when CI is set, and `npm audit --audit-level=high`.
- **e2e**: `npm ci`, Chromium and WebKit with the system packages they need, and `npm run e2e`.

When e2e fails, the run's Summary page lists the Playwright report under Artifacts as playwright-report, kept for 14 days. Anyone signed in to GitHub can download it, so tests use only made-up data. To open it, download it into a folder named for the run, because gh won't overwrite an existing file, such as a local report's index.html:

```sh
gh run download <run-id> -n playwright-report -D playwright-report/<run-id>
npx playwright show-report playwright-report/<run-id>
```

The next local `npm run e2e` deletes the whole playwright-report/ folder, downloads included, so they don't pile up.

Dependabot (.github/dependabot.yml) checks npm packages and GitHub Actions every Monday and opens pull requests only for releases at least 7 days old: one for each ecosystem's minor and patch updates, and one for each major. Dependabot alerts report a vulnerable dependency at once, and a security update pull request follows an alert without the 7-day wait.

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
