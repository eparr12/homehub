# HomeHub

Family dashboard: one React PWA with a wall layout (1920x1080 touchscreen) and a phone layout, served by one Node 26 + Hono server with SQLite, reachable only over Tailscale. Features: offline-first grocery list, Lightroom photo display, holiday countdown with seasonal themes. The GitHub repo (eparr12/homehub) is public.

## Read before you work

- docs/project-overview.md: the design. Read the section for the feature you're changing.
- docs/build-plan.md: phases and steps; my prompt names the step.
- docs/coding-standards.md: the rules, imported at the end of this file. Cite rule IDs in plans, commits and PRs.
- docs/adr/: decisions already made. Don't reverse one without proposing a new ADR.

## Commands

- `npm run dev`: server (`node --watch`, loading .env if it exists) plus Vite, with /api and /media proxied; DEV_USER stands in for the Tailscale identity
- `npm run check`: typecheck, lint, format check and unit tests; must pass before you say a task is done
- `npm run test -- --coverage`: the unit tests with the coverage table, which CI prints in every run of the check job (coverage is on whenever CI is set)
- `npm run format`: Prettier rewrites code to the style `npm run check` expects (Markdown is left alone)
- `npm run e2e`: builds the app, starts the real server on 127.0.0.1:8181 and runs Playwright's wall, iphone and android projects, with the report in playwright-report/ (`npx playwright show-report` opens it); run it when UI, PWA or sync code changed. It needs the browsers, once: `npx playwright install chromium webkit`
- `npm run build`: production web build into dist/web
- `npm run dev:server`: the server alone, on http://127.0.0.1:8080; after `npm run build` it also serves the build with the real security headers, to try the service worker
- `npm run icons`: remakes the PWA icons in src/web/public from icon.svg; commit what it writes
- `docker build -t homehub:local .`: build the production image locally (CI builds and pushes the real one)

## Layout

- src/shared: Zod schemas, intents and the intent reducer; pure TypeScript (no node:*, no DOM)
- src/server: main.ts (composition root), app.ts (Hono app, exports AppType), config.ts, db/ (connection, migrator, migrations/NNNN_name.sql), middleware/, features/
- src/web: the React app (Vite root, own tsconfig.json): main.tsx (creates the API client and the connectivity store, then renders the app with them and `window` in contexts), app/ (routes, wall and phone layouts, and AppUpdates, the root route that runs the service worker), data/ (Dexie, sync manager, API client, hooks), features/, components/, styles/ (index.css, and themes.css, which holds every color), public/ (icon.svg and the icons made from it)
- tests/e2e: Playwright, configured by playwright.config.ts at the root, with its own tsconfig.json (DOM types, for page.evaluate): start-server.ts (the test server's launcher), test-server.ts (its port and test login), fixtures.ts (the page guard) and guard.spec.ts (its tests), page-checks.ts, and the specs. A spec runs in every project unless its name ends in wall.spec.ts (the wall only) or phone.spec.ts (the phones only)
- deploy/: host update scripts
- .github: workflows/ci.yml (the check and e2e jobs), dependabot.yml and the PR template

## How we work

- You run the whole loop: work on a branch, commit with Conventional Commits, push, open the PR with `gh pr create` using the template, and tell me it's ready. Don't use plan mode or wait for approval (AI-2, AI-5).
- For sync, migrations, security, CI/CD, deploy scripts and anything that deletes data, start the PR description with a short plan: the approach, the rule IDs it touches and the tests you add (AI-2).
- I paste back a review from the HomeHub claude.ai project, ending with an instruction to merge. Fix its Blockers, handle each Should fix as the Code reviews table says, push, then merge with `gh pr merge --squash --delete-branch` once CI passes. Merge only when my message tells you to, never before the review (AI-6).
- Before a merge, wait for the checks with `gh pr checks <N> --watch`. When GitHub says the branch is behind main, run `gh pr update-branch <N>` and wait for the checks again. Never merge with `--admin` or `--auto`.
- One task per session, and pull requests under about 400 changed lines.
- Write tests first for logic. Never weaken, skip or delete a test to make it pass (TEST-10).
- Don't add a dependency without giving the reason in the PR description (GEN-9, AI-8).
- Check the installed types or official docs before using a library API that isn't already used in the repo (AI-10).
- Read files, node_modules included, with your Read, Grep and Glob tools instead of cd, cat, grep, ls, head or node -e in the shell. Those tools don't need my approval inside the repo; shell one-liners keep stopping for it.
- Never edit a migration that has run; add a new one (DATA-4).
- Never read or print .env files or anything in data/.
- When the design, commands or layout change, update docs/project-overview.md and this file in the same PR (DOC-6).

## Gotchas

- Node runs src/server by stripping types: no enums, namespaces or parameter properties; relative imports end in .ts; types use `import type`.
- better-sqlite3 is synchronous: never pass an async function to `db.transaction()`.
- Never await a network call inside a Dexie transaction.
- Instants are UTC; theme dates use Temporal in HOME_TZ, never UTC.
- The server trusts Tailscale identity headers only because Tailscale Serve on the same machine is its only client: HOST defaults to 127.0.0.1 and is 0.0.0.0 only inside the container, which Compose publishes on 127.0.0.1:8080 alone (SEC-2). Never widen either binding.
- Hono runs middleware and routes in the order app.ts adds them, so every /api route goes below `.use('/api/*', identity(...))`; only GET /api/health sits above it, and the web build's files sit last, below every /api route. A test walks app.routes and fails on any /api route that answers without an identity.
- Answer errors with `problem(c, status)` from middleware/errors.ts, or throw and let `app.onError` answer, never with c.text or c.json (SRV-4). The one exception is GET /api/health's 503, a status report that Docker and the wall's status tile read. Log through `c.get('log')`, which carries the request ID and the short name, and never log a login (SEC-7).
- `dependencies` holds only what the server loads at runtime, because the image installs with `npm ci --omit=dev`. Web libraries are bundled into dist/web, so they go in devDependencies.
- The `overrides` entry in package.json lets eslint-plugin-jsx-a11y 6.10 run on ESLint 10, which it works with but doesn't declare yet. Remove it once a jsx-a11y release supports ESLint 10.
- package.json's `allowScripts` denies better-sqlite3's install script. The package ships prebuilt binaries for Windows and Linux, but installs from the lockfile, such as `npm ci`, ignore its `"gypfile": false` and would run node-gyp, which needs Python and build tools. Never approve the script or install build tools for it. npm honors `allowScripts` from 11.16, so use Node.js 26.4 or newer, which ships npm 11.17.
- Claude Code's shell can start in the repo with a lowercase drive letter, and from there Vitest 5 fails every suite (vitest-dev/vitest#11872), so vitest.config.ts stops with an error. Run the `Set-Location` command the error prints (or the `cd` it gives for Bash), then `npm run test` or `npm run check`.
- Migrations run with foreign keys off, and the migrator checks every foreign key before each file commits. So ON DELETE actions don't fire during a migration (delete child rows yourself), and a file never contains BEGIN, COMMIT or PRAGMA foreign_keys.
- Colors live only in src/web/styles/themes.css, as #rrggbb tokens under [data-theme]; style with the token utilities, such as bg-surface-raised and text-text-muted. index.css resets Tailwind's palette, so bg-white generates nothing. themes.test.ts fails on a hex color or color function anywhere else in src/web or vite.config.ts, on a named color in CSS or wherever it could style something (a Tailwind arbitrary value, or the value of a color, fill, stroke or background property), and on a text and background pair below WEB-6. When the UI draws a new pair, add it to the test's list.
- main.tsx imports zod-config.ts first, and nothing that reaches src/shared may go above it. Zod 4 probes for eval when it creates its first object schema, which the security policy reports as a violation, and `z.config({ jitless: true })` only prevents probes for schemas created after it runs.
- The server's Content Security Policy allows only the app's own origin (SEC-8). It blocks eval and `new Function`, inline scripts, `<style>` elements, style attributes written into markup, and data: URLs. So Vite's `assetsInlineLimit` is 0, and Motion's `AnimatePresence mode="popLayout"`, which injects a `<style>`, is off-limits. Styles that React or Motion set through the DOM, such as the style prop, pass.
- Testing Library's findBy* and waitFor hang under Vitest's fake timers, because they wait on a setTimeout that only Jest's clock advances. Settle with `await act(() => vi.advanceTimersByTimeAsync(ms))`, then query with getBy*. A test file that runs Motion animations installs fake timers once, in beforeAll: jsdom and Motion each keep one frame loop for the page, and a clock swapped out between tests leaves later tests without frames.
- DATA_DIR defaults to data, the repo's gitignored data/ folder. The container must set DATA_DIR=/data, where Compose mounts the volume (step 1.8), or the database would live inside the container and be lost with it.
- The service worker runs only in a production build: devOptions stay off, so `npm run dev` never registers one. Try it with `npm run build`, then `npm run dev:server` on http://127.0.0.1:8080.
- Port 8080 serves whatever the last build left in dist/web, while development happens on Vite's port 5173. The server looks for dist/web/index.html only when it starts, so one started before the first build answers /api alone until it restarts.
- SERVER_PATH_PREFIXES in src/shared/server-paths.ts lists the paths only the server answers, /api and /media. vite.config.ts builds the worker's navigation denylist and the dev proxy from it, and the server never answers them with a file or index.html. Add a new server prefix there.
- A view's path never has a "." in its last segment. The server takes that for a file name (FILE_NAME in src/server/middleware/web-files.ts) and answers 404 when there's no such file, where the worker would answer index.html.
- AppUpdates, the root route's component, registers the worker and must stay mounted when a layout throws. So the root has RouteError, for a path with no route, and the pathless child around the layouts has LayoutError, which shows the same page for a layout that throws and takes a ready version at once. With only the root's boundary, a crash unmounts AppUpdates; with only the child's, an unknown path shows React Router's default error page. A page applies a new version once, because a crashed wall applies it twice: from the wall's effect and from LayoutError.
- Never count on vite-plugin-pwa to reload into a new version: its reload covers only a page that a worker controlled when it loaded, and nothing claims a page from a first visit. applyUpdate in AppUpdates.tsx reloads at once when `navigator.serviceWorker.controller` is null, and otherwise on controllerchange after `updateServiceWorker()`.
- Under Vitest the plugin serves a stub of `virtual:pwa-register/react` that never reports a new version, so tests replace it with vi.mock; routes.test.tsx has a fake that lets a test act as the plugin.
- vite.config.ts reads the manifest's theme and background colors from the default theme's --surface in themes.css, so no color is named twice.
- The icons in src/web/public are generated and committed, so no build needs the generator. Edit icon.svg, keep its mark inside the middle 80% (the maskable safe zone), then run `npm run icons` and look at the maskable and Apple PNGs.
- `npm audit` reports 4 moderate findings in glob and minimatch, which workbox-build runs at build time on our own files; `npm audit --audit-level=high` passes. Never run `npm audit fix --force`: it downgrades vite-plugin-pwa to 1.1.0, which doesn't support Vite 8.
- `npm run e2e` always starts its own server (`reuseExistingServer: false`) on port 8181, never 8080, which the dev server holds, as the container will from step 1.8. A taken port stops the run with "is already used". The server's output is hidden; `DEBUG=pw:webserver` shows it.
- tests/e2e/start-server.ts deletes e2e-data/, a folder it names from its own location, at the start of each run, then sets NODE_ENV, DATA_DIR, PORT and ALLOWED_USERS, removes DEV_USER and HOST, and imports main.ts. Never take that path from the environment or an argument, and never clean up at the end instead: Playwright kills the server outright (taskkill /T /F on Windows), and globalTeardown runs while it still has the database open. Playwright also loads its config again in every worker, so playwright.config.ts never makes or deletes files.
- Specs import test and expect from tests/e2e/fixtures.ts, never from @playwright/test, and ESLint enforces it. Its automatic guard fails a test whose pages log a console error, throw an uncaught error or break the Content Security Policy. A test that causes one on purpose calls `expectProblem(pattern)` first, and fails if that problem never happens. Problems read `console error at <url>: <text>`, `uncaught error: <message>` and `policy violation: <directive> blocked <what>`; warnings pass. guard.spec.ts tests the guard itself; the list reporter prints a cross beside its `test.fail()` test even when it fails as expected.
- No test is skipped in WebKit, but WebKit shows any non-HTML navigation, such as JSON from /api, in a `<pre>` of its own with a style attribute, which the Content Security Policy blocks. So a WebKit test that navigates to JSON expects the style-src-attr violation and the "Refused to apply a stylesheet" console error, as service-worker.spec.ts does. Offline, WebKit reports a failed request as "WebKit encountered an internal error", where Chromium says net::ERR_INTERNET_DISCONNECTED.
- The offline test fails in Chromium on any response that didn't come from the worker, because Chromium's HTTP cache answers offline for a file the precache lacks. WebKit answers the next page's script and stylesheet from its memory cache without asking the worker, so the check runs in Chromium only. In WebKit, a precache miss fails the load itself, which the guard reports.
- The wall's full-screen card scales up from 0.96 as it opens, so measure or scan it only once it covers the screen, as openPhotos in wall.spec.ts waits for.
- A failed e2e run uploads playwright-report/ as an artifact kept 14 days, with each failed test's trace (page snapshots and every request's headers), and anyone signed in to GitHub can download it. So test data stays made up: no real names, logins or photos (GIT-7).
- Each CI job's timeout-minutes is about three times its run time: 2 for check and 4 for e2e, from the first runs' 34 s and 1 min 16 s. A job that outgrows it is cancelled, not failed, so e2e then uploads no report; raise the timeout in the pull request that makes the job longer.
- Both CI jobs restore one npm cache, keyed on package-lock.json. After the lockfile changes, both miss it, and the job that finishes second logs "Failed to save: Unable to reserve cache ... another job may be creating this cache", which is harmless.
- CI's coverage table lists every file. Under Claude Code, Vitest leaves out the fully covered ones and adds a summary, because its std-env dependency detects an agent from the environment, so a local table looks shorter than CI's.

@docs/coding-standards.md
