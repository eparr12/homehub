# HomeHub

Family dashboard: one React PWA with a wall layout (1920x1080 touchscreen) and a phone layout, served by one Node 26 + Hono server with SQLite, reachable only over Tailscale. Features: offline-first grocery list, Lightroom photo display, holiday countdown with seasonal themes.

## Read before you work

- docs/project-overview.md: the design. Read the section for the feature you're changing.
- docs/build-plan.md: phases and steps; my prompt names the step.
- docs/coding-standards.md: the rules, imported at the end of this file. Cite rule IDs in plans, commits and PRs.
- docs/adr/: decisions already made. Don't reverse one without proposing a new ADR.

## Commands

- `npm run dev`: server (`node --watch`) plus Vite, with /api and /media proxied; DEV_USER stands in for the Tailscale identity
- `npm run check`: typecheck, lint, format check and unit tests; must pass before you say a task is done
- `npm run e2e`: Playwright; run it when UI, PWA or sync code changed
- `npm run build`: production web build into dist/web
- `docker build -t homehub:local .`: build the production image locally (CI builds and pushes the real one)

## Layout

- src/shared: Zod schemas, intents and the intent reducer; pure TypeScript (no node:*, no DOM)
- src/server: main.ts (composition root), app.ts (Hono app, exports AppType), config.ts, db/ (migrations), middleware/, features/
- src/web: the React app (Vite root, own tsconfig.json): app/, data/ (Dexie, sync manager, API client, hooks), features/, components/, styles/
- tests/e2e: Playwright
- deploy/: host update scripts

## How we work

- Use plan mode for sync, migrations, security, CI/CD, deploy scripts and anything that deletes data. The plan names the rule IDs it touches and the tests you'll add.
- One task per session, and pull requests under about 400 changed lines.
- Write tests first for logic. Never weaken, skip or delete a test to make it pass (TEST-10).
- Don't add a dependency without giving the reason in the plan (GEN-9, AI-8).
- Check the installed types or official docs before using a library API that isn't already used in the repo (AI-10).
- Never edit a migration that has run; add a new one (DATA-4).
- Never read or print .env files or anything in data/.
- Work on a branch, commit with Conventional Commits, then push and open the PR with `gh pr create` using the template. I review and merge.
- When the design, commands or layout change, update docs/project-overview.md and this file in the same PR (DOC-6).

## Gotchas

- Node runs src/server by stripping types: no enums, namespaces or parameter properties; relative imports end in .ts; types use `import type`.
- better-sqlite3 is synchronous: never pass an async function to `db.transaction()`.
- Never await a network call inside a Dexie transaction.
- Instants are UTC; theme dates use Temporal in HOME_TZ, never UTC.
- The server trusts Tailscale identity headers only because it listens on 127.0.0.1; never change the port binding.

@docs/coding-standards.md
