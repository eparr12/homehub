# HomeHub — Build Plan

Nov 23, 2026 · Ethan

## How to use this plan

Work through the phases in order: Phases 0 to 2 make HomeHub usable, and each later phase adds one feature area. Claude Code writes the code and merges it after review; each step says what to ask for and what to check before it merges.

Every step has the same parts:

- **What:** the outcome of the step.
- **Why:** the reason for doing it this way.
- **You:** the parts only you can do, such as accounts, settings and hardware. Not every step has them.
- **Prompt:** what to paste into a fresh Claude Code session. The (plan mode) marker is optional: it flags a risky step, whose pull request starts with a short plan (AI-2). Start that step in plan mode only if you want to approve the plan before Claude edits.
- **Check:** what to look for in the pull request, its review and the running app before you paste the review back for Claude to merge.
- **Done when:** the check that ends the step.
- **Learn:** where to study the ideas, so you can review what Claude writes.

Assumptions:

- Your desktop runs Windows 11 and hosts HomeHub until the NAS is ready (Phase 7). The UPERFECT plugs into the desktop as a second screen until the mini PC is ready (Phase 6).
- The design lives in docs/project-overview.md and the rules in docs/coding-standards.md; rule IDs such as SYNC-5 refer to the standards. CLAUDE.md loads the standards into every session and already tells Claude to branch, run the checks, commit, open a pull request and merge it after review, so the prompts don't repeat that.
- Each prompt is written for a new session in the repo folder (AI-3). Edit a prompt freely; the rule IDs and doc sections it names matter more than its wording.

## At a glance

Eight phases take HomeHub from installed tools to running on the NAS, and each one ends at a gate you can check.

| Phase | Gate | Target |
| --- | --- | --- |
| 0. Accounts, tools and Claude Code | Tools installed; Tailscale on the desktop and both phones | This week |
| 1. Walking skeleton | HomeHub on both phones and the UPERFECT, and every merge deploys itself | Thanksgiving weekend |
| 2. Grocery list with offline sync | A real shopping trip with no signal syncs afterwards | Mid-December |
| 3. Holiday countdown and themes | The Christmas theme is live on the wall | Before Christmas |
| 4. Grocery features | The wall is your main way to add items, and Shopping Mode works on real trips | January |
| 5. Photos | Lightroom exports appear on the wall by themselves | This winter |
| 6. Wall hardware | The mini PC runs the wall unattended for a week | When the mini PC is ready |
| 7. Move to the NAS | HomeHub runs on the NAS at the same address | When the NAS is built |

After Phase 1, the feature phases don't depend on each other. If Phase 2 runs long, do Phase 3 first, so the Christmas theme doesn't wait a year.

## Phase 0: Accounts, tools and Claude Code

Phase 0 gets every account and tool ready on the desktop, so Phase 1 is pure building.

### 0.1 Create the accounts

**What:** a GitHub account with two-factor authentication, a Tailscale account, and a Claude plan that includes Claude Code.

**Why:** GitHub hosts the code, CI/CD, the container image and security scanning, all free for a public repo. Tailscale is how every device reaches HomeHub. Azure, Cloudflare and a sign-in provider are no longer needed.

**You:**

- Sign in to GitHub (or create an account) and turn on two-factor authentication.
- Create a Tailscale account by signing in with an identity you'll keep for years, such as your Google, Microsoft, Apple or GitHub account. It owns the tailnet.
- Confirm your Claude plan: Claude Code needs a Pro, Max, Team or Enterprise plan, or a Console account; the free plan doesn't include it.

**Done when:** you can sign in to GitHub and the Tailscale admin console.

**Learn:**

- [GitHub: configure two-factor authentication](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication)
- [Tailscale quickstart](https://tailscale.com/kb/1017/install)
- [Tailscale pricing](https://tailscale.com/pricing)

### 0.2 Install the development tools

**What:** everything needed to build, run and test HomeHub on the desktop.

**Why:** Claude Code runs commands on your machine, so Git, Node, Docker and the GitHub CLI must work before it can use them.

**You:** install these in order, each from its official installer:

- Git for Windows, then set your name and email. Use your GitHub noreply address as the email, because every commit in the public repo shows it. Git for Windows also provides Git Bash, which Claude Code uses for shell commands.
- Node.js 26, the LTS release since October 28, 2026; npm comes with it. CI uses the same version.
- PowerShell 7, set as the default profile in Terminal and VS Code. The older Windows PowerShell blocks scripts by default, which breaks npm.
- VS Code, then the Claude Code extension from Anthropic, plus the ESLint, Prettier, Tailwind CSS IntelliSense, Playwright Test and Docker extensions.
- The GitHub CLI, then run `gh auth login`. Claude Code uses it to open pull requests.
- WSL 2, then Docker Desktop on the WSL 2 backend. In its settings, turn on starting Docker Desktop when you sign in. It's free for personal use.
- Tailscale for Windows (step 0.4 sets it up).
- Optional: DB Browser for SQLite, for looking inside the database.

There's no official Claude Code extension for Visual Studio. You could run the `claude` command in Visual Studio's terminal, but you'd lose the inline diffs and plan review, so use VS Code for HomeHub.

**Done when:** `git --version`, `node --version` (v26), `gh auth status` and `docker version` all work in a terminal, and the Claude Code panel opens in VS Code.

**Learn:**

- [Claude Code: advanced setup (Windows notes)](https://code.claude.com/docs/en/setup)
- [Claude Code in VS Code](https://code.claude.com/docs/en/vs-code)
- [Node.js downloads](https://nodejs.org/en/download)
- [Install PowerShell on Windows](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows)
- [GitHub CLI](https://cli.github.com/)
- [Install WSL](https://learn.microsoft.com/en-us/windows/wsl/install)
- [Docker Desktop docs](https://docs.docker.com/desktop/)
- [Pro Git book](https://git-scm.com/book/en/v2)

### 0.3 Learn Claude Code's basics

**What:** a hands-on hour with Claude Code in a throwaway folder.

**Why:** you'll direct Claude Code for the whole project, so learn its modes, memory and undo before it touches HomeHub.

**You:**

- Open an empty folder in VS Code, open Claude Code, and ask it to build a tiny Hono "hello" server in TypeScript that Node 26 runs directly.
- Try the permission modes in the extension's mode picker: Manual asks before each action, Accept edits applies file edits without asking, and Plan reads and proposes but changes nothing.
- Run /init to see the CLAUDE.md it drafts. Then try /memory, /clear for a fresh context, /compact, and /rewind to restore a checkpoint and undo a change.
- Ask it to explain a file it wrote, line by line. You'll do this often.
- Delete the folder when you're done.

**Done when:** you can explain plan mode, what CLAUDE.md is for, and how to undo a change.

**Learn:**

- [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- [Permission modes](https://code.claude.com/docs/en/permission-modes)
- [Memory and CLAUDE.md](https://code.claude.com/docs/en/memory)
- [Skills](https://code.claude.com/docs/en/skills)

### 0.4 Set up Tailscale on the desktop and both phones

**What:** a tailnet with the desktop named homehub, HTTPS certificates turned on, and both phones always connected.

**Why:** Tailscale is HomeHub's only way in (Overview: Access). Setting it up first means you can test from a phone on cellular from day one.

**You:**

- Install Tailscale on the desktop and sign in. In the admin console's DNS page, check that MagicDNS is on and turn on HTTPS Certificates.
- On the Machines page, open the desktop's menu, choose Edit machine name, turn off the auto-generated name and enter homehub. From the same menu, choose Disable key expiry.
- Note your tailnet's DNS name; HomeHub's address will be https://homehub.your-tailnet.ts.net.
- Install Tailscale on your phone and sign in. Invite your wife from the admin console's Users page, and have her sign in on her phone with her own account.
- Android: in the system VPN settings, open Tailscale's settings and turn on Always-on VPN, leaving "Block connections without VPN" off. iPhone: in the Tailscale app, tap your profile picture, then VPN On Demand, and set it to Always for both Wi-Fi and cellular.
- Turn off Wi-Fi on each phone and check that the Tailscale app shows homehub as connected.

**Done when:** both phones, on cellular, show homehub online in the Tailscale app.

**Learn:**

- [MagicDNS](https://tailscale.com/kb/1081/magicdns)
- [Enabling HTTPS](https://tailscale.com/kb/1153/enabling-https)
- [Machine names](https://tailscale.com/kb/1098/machine-names)
- [Key expiry](https://tailscale.com/docs/features/access-control/key-expiry)
- [VPN On Demand for iOS](https://tailscale.com/docs/features/client/ios-vpn-on-demand)

## Phase 1: Walking skeleton

Phase 1 puts a thin but real HomeHub on your phones and the UPERFECT, with tests and CI/CD from the first commit. Target: Thanksgiving weekend.

### 1.1 Create the repository

**What:** a public GitHub repo with the docs, CLAUDE.md, Claude Code's settings and a protected main branch.

**Why:** GIT-1 and SEC-1 start here, and Claude Code's guardrails (AI-1, AI-7) must exist before it writes any code. Rulesets, Actions and security scanning are free on public repos.

**You:**

- Create a public repository named homehub with an MIT license and a README, and clone it in VS Code.
- Add docs/project-overview.md, docs/coding-standards.md and docs/build-plan.md (this plan), plus CLAUDE.md at the root; these come from this update. Commit and push them to main, the last direct push it will get.
- Add a ruleset for main: require a pull request with zero required approvals (GitHub won't let you approve your own), require status checks, and block force pushes and deletions. You'll pick the checks in step 1.7.
- In Settings, Code security, turn on Dependabot alerts and secret scanning with push protection.
- In Settings, Actions, General, set the default workflow permissions to read-only; the image job asks for more itself.

**Prompt (plan mode):**

```text
Read CLAUDE.md and everything in docs/. Set up the repo's housekeeping:
- .gitignore (node_modules, dist, data, .env*, coverage, playwright-report,
  test-results, .claude/settings.local.json) and .gitattributes (LF endings)
- .claude/settings.json per AI-7
- .claude/skills/standards-review/SKILL.md: a skill I invoke manually that
  reviews `git diff main...HEAD` (or the paths I pass) against
  docs/coding-standards.md and reports findings grouped by severity
  (Blocker, Should fix, Nit, Praise), each citing a rule ID, file and line
- .github/pull_request_template.md from the Code reviews section
- docs/adr/0001-record-architecture-decisions.md in Michael Nygard's format
```

**Check:** the deny rules match AI-7 (ask Claude to read a .env file and watch it refuse), and the skill can't run unless you call it.

**Done when:** a direct push to main is rejected, and this setup has merged through a pull request.

**Learn:**

- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Claude Code permissions](https://code.claude.com/docs/en/permissions)
- [Architecture Decision Records](https://adr.github.io/)
- [Documenting Architecture Decisions (Nygard)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

### 1.2 Scaffold the app

**What:** one npm package with the server, web and shared folders, strict TypeScript, linting, formatting, and a first test in each Vitest project.

**Why:** the tooling enforces most of the standards automatically, so every later step starts on rails.

**You:** after this step merges, turn on CodeQL default setup in Settings, Code security, now that there's code to scan.

**Prompt (plan mode):**

```text
Scaffold HomeHub per docs/project-overview.md (Technology stack, Repository
layout) and the Tooling section of docs/coding-standards.md:
- package.json (type module, engines node 26, the scripts in the Tooling
  table) and .nvmrc
- tsconfig.base.json, root tsconfig.json and src/web/tsconfig.json as the
  standards describe; TypeScript stays on 6.x
- ESLint flat config (typescript-eslint strict and stylistic type-checked,
  react-hooks, jsx-a11y, ARCH boundary rules with allowTypeImports for
  AppType) and Prettier
- src/server: main.ts (composition root), config.ts (Zod-parsed env),
  app.ts exporting AppType with GET /api/health
- src/web: Vite 8, React 19 and Tailwind v4, with routes / (phone) and
  /wall, and a Vite proxy for /api to the server
- src/shared: the Zod schema for the health response
- Vitest projects (node and web) with one real test each
Use current stable versions, and check each library's docs or installed
types before using its API (AI-10).
```

**Check:** `npm run dev` serves the phone page and /wall; there are no enums or namespaces; relative imports end in .ts; and you can say why each dependency in package.json is there (ask about any you don't recognize).

**Done when:** `npm run check` passes and /wall shows a placeholder that reads /api/health.

**Learn:**

- [Node.js: running TypeScript natively](https://nodejs.org/api/typescript.html)
- [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Hono on Node.js](https://hono.dev/docs/getting-started/nodejs)
- [Vite guide](https://vite.dev/guide/)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [typescript-eslint: getting started](https://typescript-eslint.io/getting-started/)
- [Vitest projects](https://vitest.dev/guide/projects)

### 1.3 Add the database

**What:** SQLite with the standard settings, a migrator, an automatic backup before migrating, and a first migration.

**Why:** proving the data path now lets Phase 2 focus on sync logic, and migration discipline (DATA-4) is hard to add later.

**Prompt (plan mode):**

```text
Add the database layer per DATA-1 to DATA-11:
- src/server/db: open better-sqlite3 at DATA_DIR/homehub.db with the DATA-5
  pragmas
- a migrator that runs the numbered .sql files in src/server/db/migrations
  in order, each in a transaction, tracked by PRAGMA user_version; when any
  are pending, it first backs up the database with db.backup() into
  DATA_DIR/backups
- 0001_init.sql: the sync_state table (STRICT, one row, id 1, version 0)
- /api/health reports the database status
- tests: migrations apply to an in-memory database, re-running is a no-op,
  and a pending migration triggers a backup
```

**Check:** the table is STRICT; no async function is passed to db.transaction (DATA-7); the backup runs before migrating; and DATA_DIR comes from config.ts, not from process.env elsewhere (ARCH-6).

**Done when:** starting the server creates data/homehub.db, the health endpoint shows the database is OK, and the tests pass.

**Learn:**

- [SQLite STRICT tables](https://sqlite.org/stricttables.html)
- [SQLite write-ahead logging](https://sqlite.org/wal.html)
- [SQLite PRAGMA statements](https://sqlite.org/pragma.html)
- [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [SQLite online backup](https://sqlite.org/backup.html)

### 1.4 Add identity and the security middleware

**What:** every /api request is tied to an allowed Tailscale user, and the server has request IDs, logging, error handling and security headers.

**Why:** this replaces the old OIDC sign-in and wall pairing, because Tailscale already knows who's calling (SEC-2, SEC-3). Doing it before real data arrives means nothing is ever unprotected.

**Prompt (plan mode):**

```text
Add the server middleware per SEC-2 to SEC-8, SRV-4, SRV-6 and OBS-1 to
OBS-5, and the Access section of docs/project-overview.md:
- identity: read Tailscale-User-Login and Tailscale-User-Name, map the login
  to a short name through ALLOWED_USERS ("login=shortname" pairs, comma-
  separated), 401 otherwise; GET /api/health stays open; DEV_USER works only
  when NODE_ENV=development, and config validation rejects it otherwise
- Hono's csrf, secureHeaders (CSP: self only), bodyLimit and request ID
  middleware; pino request logs with short names, never emails;
  app.onError returning Problem Details
- GET /api/me returning the short name and display name
- route tests with app.request(): missing header 401, unknown login 401,
  allowed login 200, cross-origin form POST 403, and DEV_USER refused in a
  production config
```

**Check:** no route skips identity except health; logs show short names, not emails (SEC-7); and the error handler never returns stack traces.

**Done when:** the tests pass, and /api/me on the dev server returns your DEV_USER.

**Learn:**

- [Tailscale Serve (identity headers)](https://tailscale.com/docs/features/tailscale-serve)
- [Tailscale identity](https://tailscale.com/docs/concepts/tailscale-identity)
- [Hono middleware](https://hono.dev/docs/guides/middleware) and [CSRF protection](https://hono.dev/docs/middleware/builtin/csrf)
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [OWASP CSRF prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

### 1.5 Build the app shell and make it a PWA

**What:** the wall layout and the phone layout on theme tokens, installable as a PWA that loads offline.

**Why:** one codebase serves both screens (WEB-3), tokens from day one mean themes won't force a refactor, and installing is what puts HomeHub on your home screens.

**Prompt (plan mode):**

```text
Build the web shell per WEB-1 to WEB-12 and the Wall display requirements
in docs/project-overview.md:
- /wall: a 1920x1080 bento grid with placeholder cards for groceries,
  photos and the countdown, plus a status tile showing /api/health
- /: the phone layout with bottom navigation for Groceries, Photos and
  Holidays
- theme tokens as CSS custom properties under [data-theme], with one
  default theme for now and no hard-coded colors
- vite-plugin-pwa: manifest (name, short name, standalone, theme color, a
  full icon set including the Apple touch icon), app-shell precache, a
  navigation fallback that excludes /api and /media, and no caching of
  /api; the wall updates silently, and phones show a "new version" prompt
- touch-action: manipulation everywhere, and Motion for card transitions
  (transform and opacity only)
- an offline badge driven by navigator.onLine and failed requests
```

**Check:** DevTools, Application shows a valid manifest and an active service worker; the wall fills 1920x1080 with no scrolling (WEB-10); and no color values appear outside the token file.

**Done when:** DevTools reports the app as installable, and the shell loads in airplane mode after one online visit.

**Learn:**

- [React: Learn](https://react.dev/learn), [Thinking in React](https://react.dev/learn/thinking-in-react) and [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Learn PWA (web.dev)](https://web.dev/learn/pwa/)
- [vite-plugin-pwa guide](https://vite-pwa-org.netlify.app/guide/)
- [Tailwind CSS theme variables](https://tailwindcss.com/docs/theme)
- [Motion for React](https://motion.dev/docs/react)
- [CSS grid layout (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)

### 1.6 Set up end-to-end tests

**What:** Playwright with wall, iPhone and Android projects, running against a production build, with a first test and an accessibility scan.

**Why:** every later feature arrives with real-browser tests (SYNC-11), and the first test proves the production build actually runs.

**Prompt:**

```text
Add Playwright per the Tooling section of docs/coding-standards.md:
- projects: wall (Chromium, 1920x1080), iphone (WebKit, an iPhone device
  profile) and android (Chromium, a Pixel profile)
- the server serves dist/web, with long caching for hashed assets and no
  caching for index.html and the service worker
- webServer: build the app, then start the server in production mode with
  a temporary DATA_DIR and ALLOWED_USERS set to a test login; tests send
  the Tailscale-User-Login header through extraHTTPHeaders, so the real
  identity middleware runs
- tests: /wall shows the status tile with the database OK, / renders the
  phone navigation, and axe finds no violations on either
- npm run e2e runs everything and writes the report to playwright-report/
```

**Check:** tests find elements by role and label, not CSS selectors, and each run starts from a fresh data folder (TEST-8).

**Done when:** `npm run e2e` passes locally in all three projects.

**Learn:**

- [Playwright: getting started](https://playwright.dev/docs/intro)
- [Playwright: emulation](https://playwright.dev/docs/emulation)
- [Playwright: web server](https://playwright.dev/docs/test-webserver)
- [Playwright: accessibility testing](https://playwright.dev/docs/accessibility-testing)

### 1.7 Build the CI pipeline

**What:** a GitHub Actions workflow that checks every pull request and every push to main, plus Dependabot.

**Why:** main stays deployable (GIT-1), and every change Claude writes is proven before it merges.

**Prompt (plan mode):**

```text
Create .github/workflows/ci.yml per the CI gates in
docs/coding-standards.md:
- runs on pull requests and pushes to main, with permissions contents: read
- job check: setup-node from .nvmrc with the npm cache, npm ci, npm run
  check with coverage, npm audit --audit-level=high
- job e2e: install Playwright browsers with their dependencies, npm run
  e2e, and upload the report when it fails
- .github/dependabot.yml: weekly updates for npm and github-actions, minor
  and patch updates grouped, and typescript major 7 ignored
```

**You:** in the main ruleset, add the check and e2e jobs as required status checks.

**Check:** actions are pinned to major versions, or to commit SHAs for third-party actions; the workflow uses no secrets; and permissions are read-only.

**Done when:** a pull request shows green checks, and a deliberately failing test blocks the merge.

**Learn:**

- [GitHub Actions docs](https://docs.github.com/en/actions)
- [GitHub Actions billing (free for public repos)](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Dependabot docs](https://docs.github.com/en/code-security/dependabot)
- [Playwright on CI](https://playwright.dev/docs/ci)

### 1.8 Ship a container that deploys itself

**What:** a Docker image that CI builds and pushes to GitHub Container Registry on every merge, and a desktop that pulls and restarts it every 5 minutes.

**Why:** this is continuous deployment without exposing the desktop: the host only pulls (Overview: Hosting, deployment and backups). There's no self-hosted runner, and no Watchtower, which is archived.

**Prompt (plan mode):**

```text
Add the container build and pull-based deploy per docs/project-overview.md
(Hosting, deployment and backups), SEC-2 and SEC-9:
- Dockerfile: multi-stage; the build stage runs npm ci and npm run build;
  the runtime stage is node:26-slim with perl installed (exiftool-vendored
  needs it in Phase 5), production dependencies only (npm ci --omit=dev),
  src/server, src/shared and dist/web; runs as the node user; CMD node
  src/server/main.ts; HEALTHCHECK using node's fetch against /api/health;
  a GIT_SHA build argument reported as the version
- .dockerignore that keeps .env, data and node_modules out of the image
- compose.yaml: image ghcr.io/<owner>/homehub:${HOMEHUB_TAG:-main}, ports
  127.0.0.1:8080:8080, ./data:/data, env_file .env, restart unless-stopped,
  cap_drop ALL, no-new-privileges, stop_grace_period 10s
- CI job image: builds on pull requests; on pushes to main, also pushes to
  GHCR with the tags main and sha-<short sha>, using GITHUB_TOKEN with
  packages: write
- deploy/update.ps1: in its own folder, docker compose pull, docker compose
  up -d, prune dangling images, and append the result to update.log
- deploy/README.md: setting up C:\HomeHub, the .env keys, and the Task
  Scheduler task
```

**You:**

- After the first push to main, open the package on GitHub (your profile, Packages, homehub, Package settings) and change its visibility to Public, so the desktop can pull it without credentials.
- Create C:\HomeHub on a local disk, not in OneDrive. Copy compose.yaml and update.ps1 into it, and create .env with NODE_ENV=production, HOME_TZ=America/New_York and ALLOWED_USERS.
- In Task Scheduler, create a task that runs update.ps1 with PowerShell 7 every 5 minutes, only while you're signed in, because Docker Desktop runs in your session.
- In Windows power settings, set the desktop to never sleep when plugged in.

**Check:** the container runs as node, not root; the port is bound to 127.0.0.1 only (SEC-2); and nothing in the update script can touch the data folder.

**Done when:** merging a small change shows the new commit at http://127.0.0.1:8080/api/health within 10 minutes, with no manual steps.

**Learn:**

- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Compose file reference](https://docs.docker.com/reference/compose-file/)
- [Working with the Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Configuring a package's visibility](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)
- [docker/build-push-action](https://github.com/docker/build-push-action)

### 1.9 Put HomeHub on the tailnet, your phones and the UPERFECT

**What:** HomeHub at https://homehub.your-tailnet.ts.net, installed on both phones and running full screen on the UPERFECT.

**Why:** you start living with the app now, before the mini PC and the NAS exist.

**You:**

- In a terminal on the desktop, run `tailscale serve --bg --https=443 http://127.0.0.1:8080`, then `tailscale serve status`. Open the address on the desktop; the first visit can take a few seconds while the certificate is issued.
- Add both of your Tailscale logins to ALLOWED_USERS in C:\HomeHub\.env, then run `docker compose up -d` there.
- On each phone, on cellular, open the address. On an iPhone, use Safari, Share, then Add to Home Screen. On Android, use Chrome's menu, then Install app.
- Connect the UPERFECT to the desktop: one USB-C cable if the desktop has USB-C with DisplayPort output, otherwise HDMI plus a USB cable for touch. Power it with its own adapter.
- In Windows display settings, extend the desktop onto the UPERFECT in landscape at 1920x1080 and its highest refresh rate. Map touch to it in Control Panel, Tablet PC Settings, Setup.
- Install HomeHub as an app in Chrome or Edge on the desktop, open /wall, drag it onto the UPERFECT and switch it to full screen.

**Done when:** both phones open HomeHub from the home screen over cellular, /api/me shows the right name on each, and taps on the UPERFECT land on the wall layout.

**Learn:**

- [The tailscale serve command](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Making PWAs installable (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Dell: fixing touch input with multiple displays (Tablet PC Settings)](https://dell.com/support/kbdoc/nl-be/000132341/windows-8-und-10-touchscreen-funktionsprobleme-mit-mehrfach-touch-displays?lang=en)

### 1.10 Close out Phase 1

**What:** review, document and tag the skeleton.

**Why:** a clean, reviewed baseline makes every later phase easier to review.

**Prompt:** in a fresh session, run the review first:

```text
/standards-review src tests .github Dockerfile compose.yaml deploy
```

Then, in another fresh session, after the Blockers are fixed:

```text
Write ADR-0002 to ADR-0006 from the Decision records list in
docs/project-overview.md, each with context, decision, alternatives and
consequences. Update the README: what HomeHub is, and how to run, test and
deploy it (DOC-4).
```

**You:** have Claude fix every Blocker from the review, then tag release v0.1.0 on GitHub with release notes generated from the merged pull requests.

**Done when:** the Phase 1 gate holds: HomeHub is on both phones and the UPERFECT, every merge deploys itself, and a request without an allowed Tailscale identity gets a 401.

**Learn:**

- [Semantic Versioning](https://semver.org/)
- [GitHub: automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)

## Phase 2: Grocery list with offline sync

Phase 2 makes HomeHub useful: a grocery list that works in a store with no signal, built test-first around the sync design. Target: in daily use by mid-December.

### 2.1 Model the grocery intents

**What:** the grocery schemas, the six intents and the shared reducer, with every rule tested.

**Why:** the client and the server both apply intents through this one function (SYNC-3), so its rules must be exact before any endpoint exists.

**Prompt (plan mode):**

```text
Read the Grocery sync design in docs/project-overview.md and the SYNC rules.
In src/shared/grocery:
- Zod schemas for a grocery item (id, name, category, quantity, notes,
  status needed or purchased, addedBy, device, timestamps, isDeleted)
  and for each intent: AddItem, MarkPurchased, NeedAgain,
  SetQuantity, EditNotes and DeleteItem, each with mutationId, itemId,
  occurredAt and device
- applyIntent(item or undefined, intent), returning { ok: true, item } or
  { ok: false, reason }: pure and deterministic
- decide and test the edge cases: an intent on a deleted or unknown item,
  AddItem for an id that exists, MarkPurchased twice, NeedAgain on a needed
  item, a quantity below 1
- write the tests first
Also create .claude/rules/sync.md, scoped with paths to
src/shared/grocery/**, src/server/features/grocery/** and src/web/data/**,
summarizing SYNC-1 to SYNC-11 and pointing to the overview's sync section.
```

**Check:** the reducer does no I/O and reads no clock (the intent carries occurredAt), and each edge-case decision matches what you'd want to happen in the store.

**Done when:** a test describes every intent's normal case and its edge cases.

**Learn:**

- [TypeScript: narrowing and discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Zod docs](https://zod.dev/)
- [How Replicache works: push, pull and poke](https://doc.replicache.dev/concepts/how-it-works)

### 2.2 Design the schema

**What:** the grocery tables, the processed-mutations log and their indexes, in a new migration.

**Why:** the schema is what makes idempotency, ordered versions and tombstones possible (SYNC-4 to SYNC-6).

**Prompt:**

```text
Add the next migration, for groceries, per DATA-1 to DATA-3 and SYNC-4 to
SYNC-6:
grocery_items (with sync_version and is_deleted) and
processed_mutations (mutation_id primary key, status, reason,
processed_at). Index sync_version. Add a repo with prepared statements to
get and upsert an item, list rows changed since a version, and look up or
record a mutation. Tests run against the real migrations.
```

**Check:** every table is STRICT, booleans and statuses have CHECK constraints, and timestamps are integer milliseconds (DATA-3). Ask Claude to show EXPLAIN QUERY PLAN for the pull query; it should use the sync_version index.

**Done when:** the migration applies cleanly on your machine and in the tests.

**Learn:**

- [SQLite datatypes](https://sqlite.org/datatype3.html)
- [The SQLite query planner](https://sqlite.org/queryplanner.html)
- [EXPLAIN QUERY PLAN](https://sqlite.org/eqp.html)
- [SQLite UPSERT](https://sqlite.org/lang_upsert.html)

### 2.3 Build the push and pull endpoints

**What:** POST /api/grocery/sync/push and GET /api/grocery/sync/pull, as the Overview's sync design describes.

**Why:** this is the server half of offline sync, where correctness matters most.

**Prompt (plan mode):**

```text
Implement the grocery sync service and routes per the Server and
Versioning parts of docs/project-overview.md and SYNC-3 to SYNC-6:
- push: validate the batch with the shared schemas. In one synchronous
  db.transaction, bump sync_state with UPDATE ... RETURNING, then for each
  mutation in order: a known mutationId returns its recorded result
  (applied becomes duplicate); otherwise run applyIntent on the current
  row; on ok, upsert the row stamped with the new version and record
  applied; on error, record rejected with the reason. Return the result for
  each mutation and the version.
- pull: rows with sync_version above `since`, ordered by sync_version,
  tombstones included, up to 500; the cursor is the highest version
  returned (or `since`), and a page never splits one version
- tests: a replayed batch applies once, every changed row carries the new
  version, a delete comes back as a tombstone, a rejected mutation doesn't
  block the ones after it, and paging never skips a version
```

**Check:** nothing is awaited inside the transaction (DATA-7), the routes stay thin (ARCH-5), and outcomes are returned, not thrown (TS-7).

**Done when:** all the tests pass in CI.

**Learn:**

- [SQLite transactions](https://sqlite.org/lang_transaction.html)
- [Designing robust APIs with idempotency (Stripe)](https://stripe.com/blog/idempotency)
- [Local-first software (Ink & Switch)](https://www.inkandswitch.com/local-first/)

### 2.4 Build the client data layer

**What:** the Dexie database, the outbox, the actions, and a sync manager that pushes, pulls, rebases and retries.

**Why:** Dexie is the source of truth on every device, so the screens never wait on the network (SYNC-1, SYNC-8).

**Prompt (plan mode):**

```text
In src/web/data, per the Client part of docs/project-overview.md and
SYNC-1 to SYNC-10:
- a Dexie 4 schema: items, outbox (++seq, &mutationId), rejected, and meta
  (cursor, device name)
- actions (addItem, markPurchased and the rest) that apply the intent
  locally with the shared reducer and append it to the outbox in one Dexie
  transaction, with a uuid v7 mutationId
- a sync manager in plain TypeScript, with its API client, database and
  clock passed in: one sync at a time; runs shortly after local writes, on
  online, on visibilitychange to visible, and every 30 s while visible;
  pushes, then pulls; after a pull, rebases unsent intents in one
  transaction; removes applied and duplicate entries; moves rejected ones
  to the rejected table; backs off exponentially on network errors and 5xx
  responses only
- navigator.storage.persist() on startup
- the typed Hono client (hc<AppType>) and live-query hooks for the UI
- Vitest with fake-indexeddb: atomic writes, a retry applies once, rebase
  keeps local changes, rejection leaves the outbox, and the backoff
  schedule (fake timers)
```

**Check:** no network call happens inside a Dexie transaction (SYNC-1), components don't import the API client (WEB-4), and a network error never drops an outbox entry.

**Done when:** the Vitest suite proves each sync rule without a server.

**Learn:**

- [Dexie docs](https://dexie.org/docs/), especially [useLiveQuery](https://dexie.org/docs/dexie-react-hooks/useLiveQuery%28%29)
- [Page Visibility API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [StorageManager.persist() (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [uuid package](https://www.npmjs.com/package/uuid)

### 2.5 Add the "pull now" events

**What:** GET /api/events, a Server-Sent Events stream that tells every client to pull after a change.

**Why:** the wall shows a phone's changes within seconds, while data still travels through the one tested path (SYNC-7).

**Prompt:**

```text
Add GET /api/events with Hono's streamSSE: after any commit that changed
rows, send every client a `changed` event carrying only the latest
version, and send a comment heartbeat every 25 s. Clean up on abort and
on shutdown (SRV-8). In the sync manager, open an EventSource and call
syncSoon() on each event and after each reconnect. Test the notifier with
app.request() and the client with a fake EventSource.
```

**Check:** events carry no row data, and the stream closes on shutdown so the container stops quickly.

**Done when:** checking an item off on a phone updates the wall within a few seconds.

**Learn:**

- [Using server-sent events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Hono streaming helpers](https://hono.dev/docs/helpers/streaming)

### 2.6 Build the grocery screens

**What:** the phone list for shopping and the wall tile for adding and viewing.

**Why:** this is the first version you'll both use every day.

**Prompt (plan mode):**

```text
Build the grocery UI per the Grocery list requirements in
docs/project-overview.md and WEB-1 to WEB-11:
- phone: items grouped by category, tap to check off (checked items move
  to the bottom), and a sheet to add or edit the name, category,
  quantity and notes; rejected changes appear with retry and
  dismiss
- wall: a grocery tile with the needed items and a simple add form (the
  quick-add grid comes in Phase 4)
- a quiet "synced 2 min ago" or "offline" indicator on both
- reads only through the data/ hooks, writes only through the actions
- component tests for the loading, empty, offline and error states
```

**Check:** touch targets meet WEB-7, no component calls fetch, and every state is handled (WEB-9).

**Done when:** you can add an item on the wall and check it off on a phone.

**Learn:**

- [Managing state (React)](https://react.dev/learn/managing-state)
- [Understanding WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

### 2.7 Prove the offline flow end to end

**What:** Playwright tests for the real offline scenarios.

**Why:** the riskiest behavior gets automated proof on every pull request (SYNC-11).

**Prompt:**

```text
Add Playwright tests per SYNC-11, using two browser contexts against the
same server, one as a phone and one as the wall:
- the phone goes offline (context.setOffline(true)), checks off two items
  and comes back online; the wall shows both checked within 5 s
- the wall adds items while /api is unreachable (route it to fail), then
  the server comes back and the phone sees them
- checking off an item that was deleted meanwhile shows as rejected on
  the phone
```

**Done when:** all three scenarios pass in CI.

**Learn:**

- [Playwright: BrowserContext (setOffline)](https://playwright.dev/docs/api/class-browsercontext)
- [Playwright: mock APIs](https://playwright.dev/docs/mock)

### 2.8 Use it for a real shopping trip

**What:** one real trip with HomeHub and no paper backup.

**Why:** real phones and real dead zones reveal problems that tests can't.

**You:**

- Before leaving, check that both phones and the wall show the same list.
- In the store, check items off with no signal, then watch them sync in the parking lot.
- Back home, run `docker compose logs` in C:\HomeHub and read the trip back from the sync log lines (OBS-7).
- Turn every problem into an issue, and have Claude fix each one with a failing test first (TEST-1).
- Tag v0.2.0.

**Done when:** a full trip with no signal syncs correctly afterwards. This is the Phase 2 gate.

## Phase 3: Holiday countdown and themes

Phase 3 adds the countdown and the theme engine. Target: the Christmas theme live on the wall before Christmas.

### 3.1 Build the theme engine

**What:** a server function that takes an instant and returns the active theme, the upcoming holidays and when the answer next changes.

**Why:** themes are data, not code, and pure date logic is easy to test exhaustively.

**Prompt (plan mode):**

```text
Implement src/server/features/themes/engine.ts per the Holiday and
seasonal theme engine section of docs/project-overview.md:
- rule types: fixed (month, day), nthWeekday (month, weekday, n) and
  easter (the anonymous Gregorian algorithm), with lead and trail days, a
  kind (season or holiday) and a priority
- convert the clock's Temporal.Instant to a PlainDate in HOME_TZ, evaluate
  every rule for last, this and next year, and choose the highest-priority
  active rule, else the current season
- return the active theme, the next 3 holidays with their dates, and
  nextChangeAt (the next local midnight in HOME_TZ, as an Instant)
- tests first, with fixed instants: 9 PM on Oct 31 (Halloween), Nov 2
  (Fall), the Thanksgiving windows for 2026 and 2027, Dec 31 to Jan 1, and
  both daylight-saving change days
```

**Check:** the engine never calls Date or Temporal.Now (TS-8), and every comparison uses local dates in HOME_TZ, never UTC.

**Done when:** all the date tests pass.

**Learn:**

- [Temporal (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
- [Temporal cookbook](https://tc39.es/proposal-temporal/docs/cookbook.html)
- [Date of Easter (Wikipedia)](https://en.wikipedia.org/wiki/Date_of_Easter)

### 3.2 Store and seed the rules

**What:** a theme_rules table seeded by a migration, the GET /api/themes/current endpoint, and the client side that applies it.

**Why:** tuning a holiday becomes a data change, and the wall switches themes on time even when the server is briefly unreachable.

**Prompt:**

```text
Add the next migration, creating theme_rules (STRICT, key as the primary
key), seeded with the rules in the overview's table: the seasons at priority
10; Halloween, Thanksgiving, Christmas, New Year's and the 4th of July at
priority 100; Easter present but disabled. Use the keys spring, summer,
fall, winter, halloween, thanksgiving, christmas, newyear, july4 and
easter, with emoji artwork and 3 to 5 quotes each, stored as JSON. Add GET
/api/themes/current using the engine. On the client, cache the response
in Dexie, set data-theme on <html>, refresh at nextChangeAt, on
visibilitychange and hourly, and keep the last theme while offline.
```

**Done when:** the running container returns the right theme for today: Thanksgiving this week, and Christmas from December 1.

**Learn:**

- [SQLite JSON functions](https://sqlite.org/json1.html)

### 3.3 Design and apply the palettes

**What:** a token set (surfaces, text, accents) for each season and holiday, applied across the app.

**Why:** every component already uses tokens (WEB-5), so a theme is just a different set of values.

**Prompt:**

```text
Design token palettes for every theme key (surface, surface-raised, text,
text-muted, accent, border, banner) in src/web/styles/themes.css, starting
with Christmas, New Year's and Winter. Every text and background pair must
meet WEB-6; add a Vitest test that computes the contrast ratios from the
token values. Add a development-only switcher, /wall?theme=<key>, so I can
preview each theme.
```

**You:** look at each theme on the UPERFECT and ask for changes until it feels right; the contrast test keeps every version readable.

**Done when:** switching themes changes the whole app, and the contrast test passes for every theme.

**Learn:**

- [Using CSS custom properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/)

### 3.4 Build the countdown card

**What:** a countdown tile on the wall and a Holidays view on phones.

**Why:** this is the holiday feature itself.

**Prompt:**

```text
Build the countdown per the Holiday countdown requirements: the next 3
holidays with days remaining (from the device's local date), their
artwork, and one quote at a time that fades every 20 s on the wall (opacity
only). Tapping the tile opens the full-screen focus view. Component tests
use fake timers.
```

**Done when:** the card is right for any date you test.

**Learn:**

- [Motion for React: AnimatePresence](https://motion.dev/docs/react)

### 3.5 Test the themes end to end

**What:** automated checks that each theme renders and stays readable.

**Why:** themes change by date, so you'll rarely see most of them by accident.

**Prompt:**

```text
Add Playwright tests that stub GET /api/themes/current for each theme key,
then screenshot /wall and / and run axe on both. Use page.clock to fix the
countdown's days remaining.
```

**You:** tag v0.3.0.

**Done when:** every theme passes its screenshot and accessibility checks in CI, and the Christmas theme is live on the wall in December. This is the Phase 3 gate.

**Learn:**

- [Playwright: clock](https://playwright.dev/docs/clock)
- [Playwright: visual comparisons](https://playwright.dev/docs/test-snapshots)

## Phase 4: Grocery features

Phase 4 turns the list into the household tool from the requirements: one-tap staples on the wall, store-aware shopping on phones, and the Shopping Mode banner.

### 4.1 Rank the staples catalog

**What:** a catalog that learns what you buy, ranking staples by how often and how recently you buy them.

**Why:** the quick-add grid is only fast if the right items are on it.

**Prompt (plan mode):**

```text
Add the staples catalog: a new migration creates catalog_items, synced
like grocery items (sync_version, is_deleted). Applying MarkPurchased updates
the matching catalog entry's count and last purchase time in the same
push transaction, stamped with the same version. Add PinStaple and
HideStaple intents (additive per SYNC-10). The ranking score blends
frequency and recency in a pure function in src/shared, with tests.
```

**Done when:** after a few trips, the top staples match what you actually buy.

### 4.2 Build the quick-add staples grid

**What:** a grid of top staples by category on the wall, one tap each.

**Why:** typing on a wall-mounted screen is tiring, so the wall is mainly for one-tap adding.

**Prompt:**

```text
Build the wall's quick-add grid: the top staples grouped by category with
64-pixel targets (WEB-7). A tap sends AddItem, or SetQuantity +1 if the item
is already needed, through the actions, and shows a brief confirmation.
Keep a search-and-add field for anything not in the grid.
```

**Done when:** you can add five staples from the wall in under ten seconds.

### 4.3 Shop by store and aisle

**What:** "Start shopping at [store]" on phones, which filters to that store and groups items by aisle.

**Why:** a list in aisle order means one pass through the store.

**Prompt:**

```text
Add the stores table in a new migration, each store with an aisle order
for the categories, synced like the other grocery data, and an optional
storeId on the item and on AddItem (SYNC-10), where none means any store.
Starting a trip on the phone filters to that store, groups by aisle
order, and moves checked items to the bottom.
```

**Done when:** a trip at your usual store follows its aisle order.

### 4.4 Add Shopping Mode

**What:** a server-side shopping session that puts a banner on the wall while someone is at the store.

**Why:** the phone loses signal inside the store, so the banner can't depend on the phone's connection.

**Prompt (plan mode):**

```text
Implement Shopping Mode per the Shopping Mode part of
docs/project-overview.md: a shopping_sessions table; POST
/api/shopping/start and /api/shopping/end, which need a connection (the
button says so when offline); the current session in every pull; a
`changed` event on start and end; expiry 2 hours after the shopper's last
push, computed from the clock; and the wall banner with a "We're home"
button. Test the expiry with fixed clocks and the banner with Playwright.
```

**Done when:** on a real trip, the banner appears when you leave and disappears when you tap "We're home".

**Learn:**

- [Lease (Patterns of Distributed Systems)](https://martinfowler.com/articles/patterns-of-distributed-systems/lease.html)

### 4.5 Close out Phase 4

**What:** polish, review and tag.

**Why:** real use exposes rough edges that are cheap to fix while the code is fresh.

**You:** have Claude fix what real trips revealed, run /standards-review in a fresh session, update any ADRs, and tag v0.4.0.

**Done when:** the wall is your main way of adding items, and Shopping Mode works on real trips. This is the Phase 4 gate.

## Phase 5: Photos

Phase 5 brings your wife's photography to the wall: Lightroom exports flow in on their own and appear with their camera settings and seasonal tags.

### 5.1 Set up the inbox and the Lightroom preset

**What:** HomeHub's photo inbox on the desktop and a Lightroom export preset that writes into it.

**Why:** exporting from Lightroom should be the only step your wife ever takes.

**You:**

- Create C:\HomeHub\data\photos\inbox; the container already sees it through the ./data volume.
- In Lightroom, create an export preset named HomeHub: export to that folder, JPEG at about 85 quality, sRGB, long edge 3,000 pixels, metadata set to All Metadata, and Remove Location Info checked.
- Agree on keywords that match the theme keys (spring, summer, fall, winter, halloween, thanksgiving, christmas, newyear, july4), plus favorites.

**Done when:** an export lands in the inbox, and Windows' file properties (Details tab) still show the camera, settings and tags.

### 5.2 Build the scanner and processor

**What:** a background job that turns each new export into WebP versions and placard metadata.

**Why:** one processing path for every way a photo arrives, and none of the work happens during a request (SRV-7).

**Prompt (plan mode):**

```text
Implement the photo pipeline per the Photo pipeline section of
docs/project-overview.md, SEC-5, SEC-6 and SRV-10:
- a new migration: photos (id, sha256 unique, taken_at, width, height,
  orientation, camera, lens, focal length, aperture, shutter, iso,
  keywords as JSON, status, error, created_at)
- a job every 60 s that scans data/photos/inbox and takes files whose size
  hasn't changed since the last scan; skips duplicates by SHA-256
- exiftool-vendored (one shared instance, ended on shutdown) for EXIF,
  IPTC and XMP fields; sharp to auto-rotate and write wall.webp (inside
  1920x1080, no enlargement) and thumb.webp (400 px) with metadata
  stripped and an input pixel limit
- move the original to photos/originals, or to photos/failed with the
  reason logged
- tests with small fixture JPEGs generated in the test, including keywords
  and a missing-EXIF case
```

**Check:** the job can't overlap itself (SRV-10); no GPS data reaches the WebP files or the API (SEC-6); and a corrupt file fails cleanly without stopping the job.

**Done when:** an export from Lightroom appears in the photos table with the right metadata and both WebP files.

**Learn:**

- [sharp docs](https://sharp.pixelplumbing.com/)
- [exiftool-vendored](https://github.com/photostructure/exiftool-vendored.js)
- [ExifTool tag names](https://exiftool.org/TagNames/)

### 5.3 Serve the photos

**What:** a photo list endpoint, cached image serving, and offline photos on every device.

**Why:** the wall should keep cycling photos during an outage, and phones should load thumbnails instantly.

**Prompt:**

```text
Add GET /api/photos (ready photos with the placard fields, keywords and
orientation, paged) and serve /media/photos/:id/:variant.webp from
data/photos/web with immutable caching, since IDs are never reused. The
sync manager keeps the photo list in Dexie. In the service worker, cache
/media with CacheFirst and an entry limit (WEB-12).
```

**Done when:** after one online visit, the photo list and recent images load in airplane mode.

### 5.4 Build the photo display

**What:** the hero and diptych layout, the camera-settings placard, and a rotation weighted toward the season.

**Why:** this is the feature your wife will judge, so framing and pacing matter.

**Prompt (plan mode):**

```text
Build the photo tile and phone gallery per the Photos requirements and
display rules in docs/project-overview.md: landscape as hero; portraits
always in pairs, sharing a keyword when possible; the placard (camera,
focal length, aperture, shutter speed, ISO, keywords) on a semi-opaque
gradient; theme or season keywords 4 times as likely and favorites twice
as likely; a 30 s opacity crossfade with the next image decoded before
it shows. On phones, a thumbnail grid that opens a full-screen view.
```

**You:** watch a full rotation on the UPERFECT with your wife, and adjust the pacing and placard together.

**Done when:** a full rotation runs smoothly on the wall, with no cropping or letterboxing.

**Learn:**

- [object-fit (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit)
- [HTMLImageElement.decode() (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode)

### 5.5 Add drag-and-drop upload

**What:** a drop zone in the app for uploading photos without Lightroom's preset.

**Why:** it's the backup path for when she's on another computer.

**Prompt:**

```text
Add POST /api/photos/upload (multipart, bodyLimit 50 MB per file, JPEG
only, checked by its first bytes, saved into the inbox under a
server-generated name) and a drop zone with a status for each file. The
scanner handles the rest.
```

**You:** tag v0.5.0.

**Done when:** a dropped photo joins the rotation within about a minute. With steps 5.1 to 5.4, this is the Phase 5 gate.

**Learn:**

- [HTML Drag and Drop API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)

## Phase 6: Wall hardware

Phase 6 moves the wall from the desktop to the mini PC under the display, so it runs unattended. Start it whenever the hardware is ready; it doesn't depend on Phases 2 to 5.

### 6.1 Choose the mini PC and its operating system

**What:** a decision between Windows and Linux for the kiosk, recorded in an ADR.

**Why:** the OS decides how kiosk mode, auto-start and turning the screen off work.

**You:** weigh the options.

- Hardware: it must drive 1920x1080 at 120Hz over HDMI 2.0 or USB-C with DisplayPort, and its BIOS should be able to power on after a power cut.
- Linux (Ubuntu or Debian): sign in automatically, then Chromium in kiosk mode with the Overview's flags. It's lighter, Tailscale SSH gives you remote access, and you set up auto-start and recovery yourself.
- Windows 11 Pro: Assigned Access runs Microsoft Edge as a full-screen kiosk and relaunches it if it closes. It isn't available on Windows 11 Home.

**Done when:** the choice is recorded in an ADR.

**Learn:**

- [Windows kiosk quickstart with Assigned Access](https://learn.microsoft.com/en-us/windows/configuration/assigned-access/quickstart-kiosk)
- [Chromium command-line switches](https://peter.sh/experiments/chromium-command-line-switches/)

### 6.2 Mount and cable the hardware

**What:** the display on the wall, with the mini PC mounted right under it.

**Why:** a tidy, ventilated install keeps the wall reliable.

**You:**

- Mount the UPERFECT with its VESA mount, and the mini PC just below it.
- Use one USB-C cable if the mini PC has USB-C with DisplayPort output; otherwise use HDMI plus a USB cable for touch.
- Leave the mini PC room to breathe, because fanless boxes throttle when they're enclosed.
- Route power neatly to an outlet, ideally through a surge protector.

**Done when:** the display shows the mini PC's desktop and touch works.

### 6.3 Set up kiosk mode

**What:** the mini PC boots straight into HomeHub's wall view, locked down.

**Why:** the wall should survive power cuts, crashes and curious fingers without anyone touching a keyboard.

**You:**

- Install Tailscale, sign in as yourself, and disable key expiry for the mini PC.
- Create a dedicated, non-admin kiosk user that signs in automatically.
- Turn off notifications and update prompts, and schedule OS updates inside the 12 AM to 6 AM window.

**Prompt:**

```text
Write deploy/kiosk/ for <the OS from the ADR>: start the browser at boot on
https://homehub.<tailnet>.ts.net/wall in kiosk mode with the overview's
flags, relaunch it if it exits, reload the page nightly at 3 AM, and a
README with the setup steps.
```

**Done when:** unplugging the power and plugging it back in brings the wall back on its own.

**Learn:**

- [Chromium kiosk setup example (jitsi-box)](https://www.github.com/openfun/jitsi-box/blob/main/SETUP.md)

### 6.4 Add night mode

**What:** a black screen from midnight to 6 AM, with the display turned off.

**Why:** an entryway screen shouldn't glow all night, and turning it off saves power.

**Prompt:**

```text
Add the wall's night curtain: from 12 AM to 6 AM local time a black
screen that wakes on touch for 2 minutes. Then add deploy/kiosk scripts
and scheduled tasks for <the OS> that turn the display off at midnight
and on at 6 AM.
```

**You:** check whether a touch wakes the display while it's off. If it doesn't, the 6 AM schedule covers mornings.

**Done when:** the wall goes dark at midnight and comes back at 6 AM.

### 6.5 Retire the desktop wall

**What:** the UPERFECT runs from the mini PC alone.

**Why:** the desktop can go back to being a desktop.

**You:** disconnect the UPERFECT from the desktop, uninstall the desktop's HomeHub app window, and let the mini PC run the wall for a week.

**Done when:** the wall runs unattended for a week, through midnight sleeps and at least one power cut. This is the Phase 6 gate.

## Phase 7: Move to the NAS

Phase 7 moves hosting from the desktop to the NAS without changing HomeHub's address. Treat it as a migration with a way back, not a rebuild.

### 7.1 Build the NAS host

**What:** Ubuntu Server on the NAS, running Docker and Tailscale, with a share for the photo inbox.

**Why:** the NAS runs the same image and data folder as the desktop, so it only needs a container runtime, storage and a share.

**You:**

- Finish the hardware: a case, power supply and drives, with the data drives mirrored if you can. In the BIOS, set it to power on after a power cut.
- Install Ubuntu Server 26.04 LTS with OpenSSH, and reserve its address in your router.
- Install Docker Engine with the Compose plugin from Docker's repository, and Tailscale signed in as yourself, with key expiry disabled.

**Prompt:**

```text
Write deploy/nas/: update.sh (the Linux version of update.ps1), a systemd
service and timer that run it every 5 minutes, a Samba share definition
for /srv/homehub/data/photos/inbox writable only by my desktop user, and a
README covering folder ownership for the container's node user (uid 1000)
and every setup command.
```

**Done when:** Docker runs a test container, the desktop can write to the inbox share, and `tailscale status` shows the NAS.

**Learn:**

- [Install Ubuntu Server](https://ubuntu.com/tutorials/install-ubuntu-server)
- [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Ubuntu Server documentation](https://documentation.ubuntu.com/server/)
- [systemd timers](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)

### 7.2 Move HomeHub and its data

**What:** HomeHub running on the NAS at the same address, with all its history.

**Why:** keeping the name homehub means the installed apps, and their offline data, never notice the move.

**You:**

- Before the move, decide whether the NAS checks more than the main tag before it runs an image (ADR-0006), and whether a rule limits each person's devices now that the NAS can carry a tag (ADR-0004).
- Pick a quiet evening, and check that every device's outbox is empty.
- On the NAS, set up /srv/homehub with compose.yaml and .env, start it once to check it runs, then stop it.
- On the desktop, run `docker compose down` in C:\HomeHub, so SQLite closes cleanly, then copy the whole data folder to /srv/homehub/data on the NAS.
- On the desktop, run `tailscale serve reset`, then rename the desktop in the admin console. Rename the NAS to homehub.
- On the NAS, run `tailscale serve --bg --https=443 http://127.0.0.1:8080`, start HomeHub, and enable the update timer.
- Point the Lightroom preset at the inbox share.
- Check both phones and the wall, at home and on cellular. Keep the desktop's data folder untouched for a week as your way back.

**Done when:** both phones and the wall work against the NAS, at home and away, with every item and photo intact.

**Learn:**

- [Machine names](https://tailscale.com/kb/1098/machine-names)

### 7.3 Set up off-site backups and monitoring

**What:** a weekly encrypted off-site copy of the backups, a tested restore, and an alert if the NAS goes quiet.

**Why:** the NAS now holds the only copy of your data.

**Prompt:**

```text
Add deploy/nas/offsite-backup: a weekly systemd timer that copies the
newest file in data/backups to an rclone crypt remote, and a restore
guide. Extend update.sh to ping HEALTHCHECK_URL when it's set and
/api/health is OK.
```

**You:**

- Create an rclone remote on a free cloud drive with a crypt remote on top, and keep the crypt password in your password manager.
- Restore the newest off-site backup into a scratch folder and check that the item and photo counts match.
- Optional: create a free Healthchecks.io check and put its URL in .env.

**Done when:** an off-site backup exists, a test restore matches, and stopping the container triggers an alert email (if you set one up).

**Learn:**

- [rclone crypt](https://rclone.org/crypt/)
- [Healthchecks.io docs](https://healthchecks.io/docs/)
- [SQLite online backup](https://sqlite.org/backup.html)

### 7.4 Retire the desktop as host

**What:** HomeHub runs only on the NAS.

**Why:** the desktop can sleep again, and there's one host to look after.

**You:** disable the Task Scheduler task, delete C:\HomeHub after the week is up, let the desktop sleep again, and tag v1.0.0.

**Done when:** HomeHub runs entirely on the NAS. This is the Phase 7 gate.

## Habits for every phase

These habits run through every phase and keep HomeHub shippable and maintainable.

- **One step, one session, one PR:** start fresh for each step (AI-3), and keep pull requests under about 400 changed lines (GIT-4).
- **Plan in the PR:** risky changes start their pull request with a short plan (AI-2); plan mode is optional.
- **A review for every PR:** ask the HomeHub claude.ai project to review each pull request by its number, then paste the review back with an instruction to merge; Claude fixes the Blockers and merges once CI passes (AI-6).
- **True docs:** update the Overview and CLAUDE.md in the same PR as the change (DOC-6), then re-upload changed docs to the claude.ai project so chats there stay current.
- **ADRs:** write one whenever you choose between real alternatives.
- **A release per gate:** tag v0.1.0 through v1.0.0, so the history is easy to follow.
- **Weekly Dependabot pass:** merge green minor and patch updates; read the release notes before any major one.
- **Learn while reviewing:** read a step's Learn links before you check its pull request.
- **AI-security practice:** notice what Claude reads and runs, keep its permissions tight, and watch for instructions hidden in content it fetches.

**Learn:**

- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

## Foundational reading

These go deeper than any single step and pay off across the whole project.

- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/): transactions, replication and the trade-offs behind the sync design.
- [Local-first software (Ink & Switch)](https://www.inkandswitch.com/local-first/): why HomeHub writes to the device first.
- [Patterns of Distributed Systems (Unmesh Joshi)](https://martinfowler.com/articles/patterns-of-distributed-systems/): leases, versioning and other patterns HomeHub uses in miniature.
- [Appropriate uses for SQLite](https://sqlite.org/whentouse.html): why one file is the right database here.
- [OWASP Top 10](https://owasp.org/www-project-top-ten/): the web security risks every reviewer checks for.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/): the risks of building with AI agents, and your next career.
- [The C4 model](https://c4model.com/): a simple way to draw the architecture for the README.
