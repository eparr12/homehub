# ADR-0003: SQLite through better-sqlite3

Nov 25, 2026 · Ethan

## Status

Accepted

## Context

HomeHub's data is small: a grocery list, a catalog of staples, theme rules and photo metadata, for two people. One server process reads and writes all of it, in one container on one host (ADR-0002), and the overview's goals ask for a database that's just a file, with no cloud database.

The first design kept the data in PostgreSQL 18, through EF Core, and PostgreSQL needed care that SQLite doesn't. The sync design's pull returns every row whose version is above the client's cursor (ADR-0005), so versions have to become visible in the order they're numbered. A PostgreSQL sequence hands out its numbers when a row is written, not when its transaction commits, so a sync cursor could skip a row that committed late. The first design's fix was a counter row whose lock made writers wait.

Two other options aren't ready yet: node:sqlite, built into Node, is still a release candidate in Node 26, and so is Drizzle ORM 1.0.

## Decision

HomeHub keeps its data in one SQLite file, homehub.db in DATA_DIR, which only the server process opens. It reaches the file through better-sqlite3 13, with plain SQL in prepared statements with bound parameters (DATA-6) and no ORM. Every connection sets journal_mode WAL, synchronous NORMAL, foreign_keys ON and busy_timeout 5000 (DATA-5), and every table is STRICT (DATA-2).

The overview gives the reasons: one file and no database server to run or upgrade, the fastest option for a single process, and prebuilt binaries that keep working across Node upgrades. The sync cursor's guarantee comes for free as well. SQLite has one writer at a time, so a counter bumped inside the write transaction is always in commit order (SYNC-5):

```sql
UPDATE sync_state SET version = version + 1 WHERE id = 1 RETURNING version;
```

Building the database layer in #3 settled three more things:

- **Prebuilt binaries, and no install script.** package.json's `allowScripts` denies better-sqlite3's install script. The package ships prebuilt binaries for Windows and Linux, but an install from the lockfile, such as `npm ci`, ignores its `"gypfile": false` and would run node-gyp, which needs Python and build tools. #3 saw it: npm 11.20 ran `node-gyp rebuild`, which failed without Python and build tools. npm honors `allowScripts` from 11.16, so HomeHub needs Node.js 26.4 or newer, which ships npm 11.17.
- **Migrations run with foreign keys off.** Each numbered file runs with its `PRAGMA user_version` in one transaction, after a backup of any database that already has a schema (DATA-4). SQLite's table-rebuild procedure needs foreign keys off, because the pragma does nothing inside a transaction, and while it's on, a DROP TABLE runs the ON DELETE actions on the child rows. So the migrator turns them off for the file and checks every foreign key before the file commits, and a broken reference rolls the file back. ON DELETE actions don't fire during a migration, and a file never contains BEGIN, COMMIT or PRAGMA foreign_keys.
- **A newer database starts with a warning.** When the database's version is above the image's newest migration, the migrator logs a warning and starts without migrating. Migrations only add tables and columns (DATA-11), so this is what lets a rollback to an older image work.

## Alternatives considered

**PostgreSQL**, the first design's database. It's a database server beside the app, one more thing to run, upgrade and back up for data this small. Its sequences also hand out numbers before commit, so the sync cursor needed a counter row whose lock made every writer wait. SQLite's one writer gives the same order, as long as the bump and the writes share one transaction.

**node:sqlite**, which ships with Node and would need no dependency at all. It's still a release candidate in Node 26, so better-sqlite3 stays until it's stable.

**Drizzle ORM 1.0** on top of either driver. It's still a release candidate as well, and plain SQL keeps the dependency list short.

## Consequences

**The driver is synchronous.** better-sqlite3 blocks the event loop while a query runs, so queries are indexed and bounded with LIMIT, and slow work, such as processing a photo, runs in a background job, never in a request (SRV-7). Transaction functions are synchronous too: better-sqlite3 throws when one returns a promise, and code after an await would run outside the transaction, so no async function ever goes to `db.transaction()` (DATA-7).

**One process opens the file** (DATA-5). Every read and write goes through the server, and a backup comes from `db.backup()` or VACUUM INTO, never from a copy of the live file (DATA-10).

**The file needs a disk that's local to that process.** SQLite's locks and write-ahead log can't be trusted on a network share, in a cloud-synced folder or, under Docker Desktop, in a folder shared from Windows, so on the desktop the database sits in a Docker volume (DATA-9). ADR-0006 has the reasons. Finished backups are ordinary files, so they sit in the deploy folder, where they outlast the volume.

**The schema only moves forward.** A migration that has run anywhere is never edited, and a change is a new file (DATA-4). Migrations add tables and columns in one release and remove old ones in a later one (DATA-11), so the previous image still runs after a rollback.

better-sqlite3 stays until node:sqlite is stable, as the overview's Version notes say, and then this choice gets another look.
