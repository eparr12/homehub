# HomeHub

HomeHub is a family dashboard for a 21.5-inch wall touchscreen in our entryway, with a companion app on our phones. It has three features: a grocery list that works with no signal and syncs when service returns, a display for Lightroom photography, and a holiday countdown with seasonal themes.

> **Status:** Phase 1, the walking skeleton, is in progress. The .NET solution builds and runs under Aspire with a healthy API; the database, web app and tests come next.

## Stack

.NET 10 with Aspire · PostgreSQL 18 · React 19, TypeScript and Vite · Dexie (IndexedDB) offline sync · SignalR · Azure Container Apps now, a home NAS later. Everything runs on free tiers.

## Run it locally

You need:

- The [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0). [global.json](global.json) pins it, so a newer SDK such as .NET 11 isn't used.
- The [Aspire CLI](https://aspire.dev/get-started/install-cli/), version 17.0, to match the Aspire packages in [Directory.Packages.props](Directory.Packages.props).

From the repo root:

```shell
aspire doctor
aspire run
```

`aspire doctor` checks your setup, including the SDK and the HTTPS development certificate. `aspire run` builds and starts the AppHost and the API, then prints a Dashboard link. Open the full link, which includes a sign-in token, and the `api` resource turns Running and Healthy, with its logs, traces and metrics. Press Ctrl+C to stop.

## Documentation

- [Project overview](docs/project-overview.md): requirements, architecture and the sync design
- [Coding standards](docs/coding-standards.md): the rules every pull request follows
- [Architecture decision records](docs/adr/): why HomeHub is built the way it is

## License

[MIT](LICENSE)
