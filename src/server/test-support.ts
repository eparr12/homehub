import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { type Logger, pino } from 'pino';
import { onTestFinished } from 'vitest';
import { openDatabase } from './db/connection.ts';
import { MIGRATIONS_DIR, migrate } from './db/migrator.ts';

/** Creates an empty folder that's deleted when the current test finishes. */
export function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'homehub-test-'));
  // onTestFinished runs hooks in reverse order, so this one runs after the
  // hooks that close the databases opened inside the folder: Windows can't
  // delete an open database file.
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

/** Opens a database that's closed when the current test finishes. */
export function openTestDatabase(filename: string): Database.Database {
  const db = openDatabase(filename);
  onTestFinished(() => {
    db.close();
  });
  return db;
}

/** Opens an in-memory database built by the real migrations (TEST-6). */
export async function openMigratedDatabase(): Promise<Database.Database> {
  const db = openTestDatabase(':memory:');
  await migrate(db, {
    migrationsDir: MIGRATIONS_DIR,
    // Never written: the migrator doesn't back up a new database, and if it
    // ever did, this missing folder would fail the test.
    backupsDir: join(tmpdir(), 'homehub-test-no-backups'),
    clock: () => Temporal.Instant.fromEpochMilliseconds(0),
    log: pino({ level: 'silent' }),
  });
  return db;
}

/** A logger that keeps every line it writes, parsed, with the level as a label. */
export function captureLogs(): {
  readonly log: Logger;
  readonly lines: readonly unknown[];
} {
  const lines: unknown[] = [];
  const log = pino(
    {
      base: null,
      timestamp: false,
      formatters: { level: (label) => ({ level: label }) },
    },
    {
      write: (line: string) => {
        lines.push(JSON.parse(line));
      },
    },
  );
  return { log, lines };
}
