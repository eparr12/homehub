# homehub
HomeHub: our family dashboard for a wall touchscreen and our phones

## Develop

You need Node.js 26.4 or newer, in the 26 line that .nvmrc names. It ships npm 11.17, and npm before 11.16 ignores package.json's `allowScripts`. You also need PowerShell 7.4 or newer (`pwsh`), because `npm run check` runs the tests of the host's update script. Then:

```sh
npm ci           # install exactly what package-lock.json lists
npm run dev      # the server on 127.0.0.1:8081 and the app on http://localhost:5173
npm run check    # typecheck, lint, format check and unit tests
```

The phone layout is at http://localhost:5173/ and the wall layout at http://localhost:5173/wall. Vite forwards /api and /media to the server. Develop on port 5173: port 8081 serves whatever the last build left in dist/web. Port 8080 belongs to the container that runs HomeHub on the desktop.

The server keeps its SQLite database in data/homehub.db, and saves a backup in data/backups before each migration. The data/ folder is gitignored; set DATA_DIR to use another folder.

## Try the installable app

`npm run dev` never runs the service worker. To install HomeHub or load it offline, build it, then start the server, which serves the build:

```sh
npm run build       # the production web build into dist/web
npm run dev:server  # the server on http://127.0.0.1:8081: /api, and the build
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

`npx playwright show-report` serves the report on port 9323 until you press Ctrl+C. While an earlier report is still being served there, it stops with "listen EADDRINUSE: address already in use"; `npx playwright show-report --port 9324` serves it on another port.

## Continuous integration

GitHub Actions runs .github/workflows/ci.yml on every pull request and every push to main. A pull request merges only when all three of its jobs pass:

- **check**: `npm ci`, `npm run check`, which prints a coverage table when CI is set, and `npm audit --audit-level=high`.
- **e2e**: `npm ci`, Chromium and WebKit with the system packages they need, and `npm run e2e`.
- **image**: `docker build --check`, the image build with the commit as GIT_SHA, and a smoke test that starts the image through compose.yaml, as the host runs it. The test first checks that the server refuses to start with a backups folder it can't write to. Then, with a writable one, it checks that the server runs as node, that /api/health reports ok and the commit, that /api/me answers a test login and / the app, and that it stops with exit code 0. On a push to main, the job then pushes the image to GHCR as `sha-` and the commit's first 7 characters, and as `main` if main still names that commit.

When e2e fails, the run's Summary page lists the Playwright report under Artifacts as playwright-report, kept for 14 days. Anyone signed in to GitHub can download it, so tests use only made-up data. To open it, download it into a folder named for the run, because gh won't overwrite an existing file, such as a local report's index.html:

```sh
gh run download <run-id> -n playwright-report -D playwright-report/<run-id>
npx playwright show-report playwright-report/<run-id>
```

The next local `npm run e2e` deletes the whole playwright-report/ folder, downloads included, so they don't pile up.

Dependabot (.github/dependabot.yml) checks npm packages, GitHub Actions and the Dockerfile's Node base image every Monday and opens pull requests only for releases at least 7 days old: one for each ecosystem's minor and patch updates, one for each major, and one when the base image's tag moves to a new digest. Dependabot alerts report a vulnerable dependency at once, and a security update pull request follows an alert without the 7-day wait.

## Deploy

Every merge to main deploys itself. CI pushes the image to GHCR, and on the desktop a scheduled task runs deploy/update.ps1 every 5 minutes, which pulls the image and starts it. deploy/README.md sets up the host: the deploy folder, its .env, the task, the log, and how to roll back. Its Publishing on the tailnet section puts HomeHub at its address, and Who may use it adds a person.

## Put it on a phone or the wall

Each device opens HomeHub at `https://homehub.<tailnet>.ts.net`. A new person first needs what deploy/README.md's Who may use it lists.

### A phone

Open the address in the phone's browser, then install it:

- **iPhone:** in Safari, tap Share, then Add to Home Screen, and leave Open as Web App on. Not tried yet: both phones are Android.
- **Android:** in Chrome, open the menu, tap Add to Home screen, then Install. In Edge, open the menu, tap Add to phone, then Install, not Create shortcut.

Open HomeHub once from its icon while online before you count on it offline. The check is /api/me at the address in the browser, which shows your short name. To keep Tailscale connected, follow Phones stay connected under Access: private by design in docs/project-overview.md.

### The wall, until Phase 6

Until the mini PC arrives in Phase 6, the UPERFECT is the desktop's second screen:

1. Connect an HDMI cable from the graphics card's HDMI port to the UPERFECT's port marked HD. The card has three DisplayPorts, one HDMI and no USB-C, and the UPERFECT takes HDMI or USB-C but has no DisplayPort input, so the monitor that was on the card's HDMI moves to a DisplayPort. For touch, run a USB cable from the desktop to the UPERFECT's TYPE-C port. The UPERFECT runs on its own power adapter.
2. In Windows' display settings, extend the desktop onto it, in landscape at 1920 by 1080, 120 Hz and 100% scale. The wall is built and tested at that size (WEB-10).
3. Map the touch to it: run `multidigimon -touch` and follow its prompts.
4. Open the wall in an Edge app window, since Edge on this desktop can't install apps: Apps is greyed out in its menu, which says Managed by your organization. Press Win+R and run `msedge --app=https://homehub.<tailnet>.ts.net/wall`, which opens a window with no tabs and no address bar. Move it onto the UPERFECT with Win+Shift+Left or Right arrow, and press F11 for full screen. If F11 does nothing, click inside the window first, or press Fn+F11 on a keyboard whose F keys are media keys.
5. Keep the screens on: `powercfg /change monitor-timeout-ac 0`.

What the desktop can't do: its lock screen shows on the UPERFECT too, and after a restart the wall is back only once you've signed in and run step 4's command again.

## Configure

The server reads its settings from environment variables. `npm run dev` and `npm run dev:server` load them from a .env file in the repo folder, if there is one; in production, compose.yaml passes in the .env from the host's deploy folder. The repo's .env is gitignored and holds only development values (SEC-1).

| Variable | Default | What it does |
| --- | --- | --- |
| `ALLOWED_USERS` | None; the server won't start without it | The Tailscale logins that may use HomeHub, each with a short name that logs and the app show instead of the email address. Write comma-separated `login=shortname` pairs, such as `alex@example.com=alex,sam@example.com=sam`. Logins match in any letter case, and a short name is lowercase letters, digits and hyphens. |
| `NODE_ENV` | `production` | `development` or `production`. Only development allows `DEV_USER`. |
| `DEV_USER` | None | One of the logins in `ALLOWED_USERS`. In development, where no Tailscale Serve adds identity headers, a request without the Tailscale-User-Login header counts as this user. |
| `GIT_SHA` | `dev` | The version that /api/health reports. The image sets it to the commit it was built from. |

A .env file for development:

```sh
NODE_ENV=development
ALLOWED_USERS=alex@example.com=alex
DEV_USER=alex@example.com
```

With it, `npm run dev:server` answers http://127.0.0.1:8081/api/me with `{"shortName":"alex","displayName":"alex"}`.

In production, the image and compose.yaml both set `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080` and `DATA_DIR=/data`, and compose.yaml's values win over .env, so nothing in it can change them. Compose publishes the port on 127.0.0.1:8080 only (SEC-2), mounts a Docker volume that holds the database at /data, and mounts the deploy folder's data/backups at /data/backups.
