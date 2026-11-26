# ADR-0002: One TypeScript stack on Node 26

Nov 25, 2026 · Ethan

## Status

Accepted

## Context

HomeHub's first design was .NET 10 with Aspire, EF Core and PostgreSQL 18 behind a React PWA with Dexie. It was to run on Azure first and on the NAS later, with OIDC sign-in, SignalR for live updates and Cloudflare R2 for photos.

It was also my portfolio project for senior and lead developer and solutions architect roles, so parts of it were there to show enterprise practice: Aspire, a six-project Clean Architecture layout, OpenTelemetry, YARP, OpenAPI type generation and Testcontainers.

On November 23, 2026 that changed. My career focus moved to C++ and AI security, with a separate portfolio project, and HomeHub became a passion project: one that AI builds as much as possible, that I maintain alone for years, and that costs $0 to run. The overview's five goals now measure every choice: reliable every day, $0 to run, the best fit for each part, maintainable for years by one person with AI help, and private by design.

About half of the first stack was there to be shown. In a project that no longer has to show anything, that half would cost upkeep and pay nothing back.

## Decision

HomeHub is one TypeScript codebase in one npm package, from the wall to the database. The React PWA lives in src/web and the server in src/server, and src/shared holds what both of them import: the Zod schemas now, and the intent reducer from Phase 2 (ADR-0005). The server is Node.js 26 LTS with Hono 4, one process in one container, on hardware we own from the first day: the desktop now and the NAS from Phase 7 (ADR-0006). The database is SQLite (ADR-0003) and the way in is Tailscale (ADR-0004), so Azure, Cloudflare and a sign-in provider are no longer needed.

The reasons:

- **One language on both sides.** The client and the server share the Zod schemas now, and the intent reducer from Phase 2, so the compiler catches a change that touches one side only. That matters most when an AI writes the code.
- **No build step for the server.** Node 26 runs the server's TypeScript by stripping its types, so the image runs src/server/main.ts as it is in the repo.
- **No generated code.** Hono's client takes its types from the routes: src/web imports `type AppType` from src/server/app.ts, and the compiler checks each call that `hc<AppType>` makes against the routes as they are (SRV-1, SRV-3).
- **Our own hardware from day one.** There's no cloud credit to watch (the first plan's free cloud database lasted 12 months) and no later move off the cloud.

What stayed from the first design: the React, Vite, Tailwind and Dexie PWA, the intent outbox, and pull requests with CI.

## Alternatives considered

The alternative is the first design, part by part. ADR-0003 weighs its database, ADR-0004 its access and ADR-0006 its deployment, so this record weighs the rest.

**.NET 10 and Aspire for the server.** It's the stack I know: my background is about 3.5 years of Blazor and .NET. But beside a React client it means two languages, so the schemas and the intent reducer would exist once in C# and once in TypeScript, and no compiler would catch a change to one copy only. Aspire, the six-project layout, OpenTelemetry and YARP were there to show enterprise practice, and HomeHub no longer has to show it. The overview picks each tool for the job and the hardware it runs on, not by familiarity.

**Generated API types.** The first design generated the client's types from the server's OpenAPI document. Hono's typed client needs no generator: the client's types come from the server's routes, so the two can't drift.

**SignalR for live updates.** HomeHub will send clients only a "pull now" nudge with no data in it (SYNC-7, ADR-0005). Server-Sent Events carry that over plain HTTP, browsers reconnect to them on their own, and Hono's streamSSE helper can send them, so the server needs nothing more.

## Consequences

I maintain a stack I have less experience in, since my background is Blazor and .NET, so the standards, the tests and the reviews carry more of the load. Every rule in docs/coding-standards.md has an ID and is written to be checked, tools enforce what they can, every pull request gets a review from the HomeHub claude.ai project before it merges (AI-6), and the build plan's Learn links are there so I can review what Claude writes.

Running TypeScript by stripping types allows only syntax that can be erased: no enums, namespaces or parameter properties, relative imports that end in .ts, and `import type` for types (TS-2, TS-3). The two sides share a package but keep their boundaries: src/shared stays pure TypeScript, src/web imports nothing from src/server but `type AppType`, and src/server imports nothing from src/web, which ESLint enforces (ARCH-1 to ARCH-3, ARCH-7).

The versions are pinned, and the overview's Version notes say when they move:

- **Node.js 26** has been the Active LTS release since October 28, 2026. It moves to maintenance in October 2027 and reaches end of life on April 30, 2029. .nvmrc, package.json's engines and the node:26-slim base image name it, and Dependabot ignores the majors of @types/node and the base image, which follow .nvmrc. Node.js 27 becomes LTS in October 2027, and the upgrade comes after that.
- **TypeScript** stays on 6.0, the last JavaScript-based compiler. TypeScript 7.0 ships no API yet, so typescript-eslint can't run on it, and the switch comes once typescript-eslint supports TypeScript 7.1.
- **node:sqlite and Drizzle ORM 1.0** are still release candidates (ADR-0003).

The host has to be on, because there's no cloud behind it. While the desktop is the host it must never sleep, and after a Windows Update restart HomeHub comes back only once someone signs in.
