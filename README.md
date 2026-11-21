# HomeHub

HomeHub is a family dashboard for a 21.5-inch wall touchscreen in our entryway, with a companion app on our phones. It has three features: a grocery list that works with no signal and syncs when service returns, a display for Lightroom photography, and a holiday countdown with seasonal themes.

> **Status:** Phase 1, the walking skeleton, is in progress. The .NET solution runs under Aspire with a healthy API and a PostgreSQL 18 database that the API migrates when it starts; the web app and tests come next.

## Stack

.NET 10 with Aspire · PostgreSQL 18 · React 19, TypeScript and Vite · Dexie (IndexedDB) offline sync · SignalR · Azure Container Apps now, a home NAS later. Everything runs on free tiers.

## Run it locally

You need:

- The [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0). [global.json](global.json) pins it, so a newer SDK such as .NET 11 isn't used.
- The [Aspire CLI](https://aspire.dev/get-started/install-cli/), version 17.0, to match the Aspire packages in [Directory.Packages.props](Directory.Packages.props).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io/), running, because the AppHost starts PostgreSQL in a container.

From the repo root:

```shell
aspire doctor
aspire run
```

`aspire doctor` checks your setup, including the SDK, the container runtime and the HTTPS development certificate. `aspire run` builds and starts the AppHost, a PostgreSQL 18 container and the API, then prints a Dashboard link. Open the full link, which includes a sign-in token. The `api` resource waits for the database, applies any pending migrations ([ADR-0002](docs/adr/0002-apply-migrations-at-startup.md)), then turns Running and Healthy, with its logs, traces and metrics. The container keeps no data between runs, so each run starts with a fresh database. Press Ctrl+C to stop.

### Browse the database

`aspire run` also starts [pgAdmin](https://www.pgadmin.org/), a web GUI for browsing and querying the database. Once pgAdmin is up, the `postgres` resource in the dashboard shows a **Manage (pgAdmin)** link. It opens pgAdmin already connected to the local server, with no sign-in. pgAdmin runs only on your machine and is never deployed.

## Change the database schema

Schema changes go through EF Core migrations, and each migration's SQL is reviewed before it merges ([DATA-4](docs/coding-standards.md#data-and-ef-core)). The EF Core tool is pinned as a local tool, so restore it once after you clone. Then, from the repo root, add the migration and print its SQL. In this example the new migration is AddItems, and `migrations script` prints only what changed since AddSyncState, the one before it:

```shell
dotnet tool restore
dotnet ef migrations add AddItems --project src/HomeHub.Infrastructure --startup-project src/HomeHub.Api --output-dir Persistence/Migrations
dotnet ef migrations script AddSyncState AddItems --project src/HomeHub.Infrastructure --startup-project src/HomeHub.Api
```

The API applies the new migration the next time it starts.

## Documentation

- [Project overview](docs/project-overview.md): requirements, architecture and the sync design
- [Coding standards](docs/coding-standards.md): the rules every pull request follows
- [Architecture decision records](docs/adr/): why HomeHub is built the way it is

## License

[MIT](LICENSE)
