import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { type Level, type Logger, pino } from 'pino';
import { expect, onTestFinished } from 'vitest';
import { type AppDependencies, createApp } from './app.ts';
import type { AllowedUsers } from './config.ts';
import { openDatabase } from './db/connection.ts';
import { MIGRATIONS_DIR, migrate } from './db/migrator.ts';

/** The users that route tests allow, as parseConfig builds them from ALLOWED_USERS. */
export const ALLOWED_USERS: AllowedUsers = new Map([
  ['alex@example.com', 'alex'],
  ['zoë@example.com', 'zoe'],
]);

/** The version that test apps report, a made-up commit like an image's GIT_SHA. */
export const TEST_VERSION = '0123456789abcdef0123456789abcdef01234567';

/**
 * Matches any number in an expected value. Typed unknown because expect.any()
 * returns `any`, which strict linting refuses inside an object (TS-1).
 */
export const ANY_NUMBER: unknown = expect.any(Number);

/** The identity headers that Tailscale Serve adds to a request from Alex. */
export const ALEX_HEADERS = {
  'Tailscale-User-Login': 'alex@example.com',
  'Tailscale-User-Name': 'Alex Example',
} as const;

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

/**
 * Builds the app on a migrated in-memory database, allowing ALLOWED_USERS and
 * reporting TEST_VERSION, with whatever dependencies the test overrides.
 */
export async function createTestApp(
  overrides: Partial<AppDependencies> = {},
): Promise<ReturnType<typeof createApp>> {
  return createApp({
    db: await openMigratedDatabase(),
    log: captureLogs().log,
    allowedUsers: ALLOWED_USERS,
    version: TEST_VERSION,
    ...overrides,
  });
}

/** Reads a Problem Details body, raw, after checking its media type (SRV-4). */
export async function readProblem(response: Response): Promise<unknown> {
  expect(response.headers.get('Content-Type')).toBe('application/problem+json');
  return response.json();
}

/**
 * A logger that keeps every line it writes at `level` or above, parsed, with
 * the level as a label.
 */
export function captureLogs(level: Level = 'info'): {
  readonly log: Logger;
  readonly lines: readonly unknown[];
} {
  const lines: unknown[] = [];
  const log = pino(
    {
      level,
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
