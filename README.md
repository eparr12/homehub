# HomeHub

HomeHub is a family dashboard for a 21.5-inch wall touchscreen in our entryway, with a companion app on our phones. It has three features: a grocery list that works with no signal and syncs when service returns, a display for Lightroom photography, and a holiday countdown with seasonal themes.

> **Status:** Phase 1, the walking skeleton, is in progress. There's no code to run yet; setup and test instructions arrive with the code.

## Stack

.NET 10 with Aspire · PostgreSQL 18 · React 19, TypeScript and Vite · Dexie (IndexedDB) offline sync · SignalR · Azure Container Apps now, a home NAS later. Everything runs on free tiers.

## Documentation

- [Project overview](docs/project-overview.md): requirements, architecture and the sync design
- [Coding standards](docs/coding-standards.md): the rules every pull request follows
- [Architecture decision records](docs/adr/): why HomeHub is built the way it is

## License

[MIT](LICENSE)
