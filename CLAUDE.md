# HomeHub

Family dashboard: one React PWA with a wall layout (1920x1080 touchscreen) and a phone layout, served by one Node 26 + Hono server with SQLite, reachable only over Tailscale. Features: offline-first grocery list, Lightroom photo display, holiday countdown with seasonal themes. The GitHub repo (eparr12/homehub) is public.

## Read before you work

- docs/project-overview.md: the design. Read the section for the feature you're changing.
- docs/build-plan.md: phases and steps; my prompt names the step.
- docs/coding-standards.md: the rules, imported at the end of this file. Cite rule IDs in plans, commits and PRs.
- docs/adr/: decisions already made. Don't reverse one without proposing a new ADR.

## Commands

- `npm run dev`: server (`node --watch`) plus Vite, with /api and /media proxied; DEV_USER stands in for the Tailscale identity
- `npm run check`: typecheck, lint, format check and unit tests; must pass before you say a task is done
- `npm run format`: Prettier rewrites code to the style `npm run check` expects (Markdown is left alone)
- `npm run e2e`: Playwright; run it when UI, PWA or sync code changed
- `npm run build`: production web build into dist/web
- `docker build -t homehub:local .`: build the production image locally (CI builds and pushes the real one)

## Layout

- src/shared: Zod schemas, intents and the intent reducer; pure TypeScript (no node:*, no DOM)
- src/server: main.ts (composition root), app.ts (Hono app, exports AppType), config.ts, db/ (connection, migrator, migrations/NNNN_name.sql), middleware/, features/
- src/web: the React app (Vite root, own tsconfig.json): app/, data/ (Dexie, sync manager, API client, hooks), features/, components/, styles/
- tests/e2e: Playwright
- deploy/: host update scripts

## How we work

- You run the whole loop: work on a branch, commit with Conventional Commits, push, open the PR with `gh pr create` using the template, and tell me it's ready. Don't use plan mode or wait for approval (AI-2, AI-5).
- For sync, migrations, security, CI/CD, deploy scripts and anything that deletes data, start the PR description with a short plan: the approach, the rule IDs it touches and the tests you add (AI-2).
- I paste back a review from the HomeHub claude.ai project, ending with an instruction to merge. Fix its Blockers, handle each Should fix as the Code reviews table says, push, then merge with `gh pr merge --squash --delete-branch` once CI passes. Merge only when my message tells you to, never before the review (AI-6).
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
- `dependencies` holds only what the server loads at runtime, because the image installs with `npm ci --omit=dev`. Web libraries are bundled into dist/web, so they go in devDependencies.
- The `overrides` entry in package.json lets eslint-plugin-jsx-a11y 6.10 run on ESLint 10, which it works with but doesn't declare yet. Remove it once a jsx-a11y release supports ESLint 10.
- package.json's `allowScripts` denies better-sqlite3's install script. The package ships prebuilt binaries for Windows and Linux, but installs from the lockfile, such as `npm ci`, ignore its `"gypfile": false` and would run node-gyp, which needs Python and build tools. Never approve the script or install build tools for it. npm honors `allowScripts` from 11.16, so use Node.js 26.4 or newer, which ships npm 11.17.
- Claude Code's shell can start in the repo with a lowercase drive letter, and from there Vitest 5 fails every suite (vitest-dev/vitest#11872), so vitest.config.ts stops with an error. Run the `Set-Location` command the error prints (or the `cd` it gives for Bash), then `npm run test` or `npm run check`.
- Migrations run with foreign keys off, and the migrator checks every foreign key before each file commits. So ON DELETE actions don't fire during a migration (delete child rows yourself), and a file never contains BEGIN, COMMIT or PRAGMA foreign_keys.
- DATA_DIR defaults to data, the repo's gitignored data/ folder. The container must set DATA_DIR=/data, where Compose mounts the volume (step 1.8), or the database would live inside the container and be lost with it.

@docs/coding-standards.md
