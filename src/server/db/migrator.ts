import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import type { Logger } from 'pino';
import { z } from 'zod';

/** The numbered SQL files that ship with the server. */
export const MIGRATIONS_DIR = fileURLToPath(
  new URL('migrations', import.meta.url),
);

/** What migrate() needs from main.ts or a test (TS-11). */
export interface MigrateOptions {
  readonly migrationsDir: string;
  readonly backupsDir: string;
  readonly clock: () => Temporal.Instant;
  readonly log: Logger;
}

interface Migration {
  readonly version: number;
  readonly file: string;
  readonly sql: string;
}

// NNNN is the user_version that the file brings the schema to.
const MIGRATION_FILE = /^(\d{4})_[a-z][a-z0-9_]*\.sql$/;
const VERSION_DIGITS = 4;
const userVersionSchema = z.number().int().nonnegative();
// The first broken reference, if any. pragma_foreign_key_check's columns are
// table, rowid, parent and fkid, and "table" needs quotes: it's a keyword.
const FIRST_BROKEN_FOREIGN_KEY_SQL =
  'SELECT "table", parent FROM pragma_foreign_key_check LIMIT 1';
const brokenForeignKeySchema = z.object({
  table: z.string(),
  parent: z.string(),
});

/**
 * Applies the pending migrations in order, each in its own transaction
 * (DATA-4), after backing up a database that already has a schema. Foreign
 * keys are off while a file runs, so ON DELETE actions don't fire, and all of
 * them are checked before the file commits. Files never contain BEGIN, COMMIT
 * or PRAGMA foreign_keys.
 */
export async function migrate(
  db: Database.Database,
  options: MigrateOptions,
): Promise<void> {
  const migrations = loadMigrations(options.migrationsDir);
  const current = readUserVersion(db);
  const newest = migrations.at(-1)?.version ?? 0;
  if (current > newest) {
    // An older image after a rollback. Later migrations only added tables
    // and columns, so it can still run (DATA-11).
    options.log.warn(
      { version: current, newest },
      'database is newer than the migrations',
    );
    return;
  }
  const pending = migrations.filter(({ version }) => version > current);
  if (pending.length === 0) return;
  // A new database has nothing to save. The backup finishes before the first
  // migration starts, because a backup copies in any change that the same
  // connection makes while it runs.
  if (current > 0) await backUp(db, current, options);
  for (const migration of pending) {
    applyMigration(db, migration);
    options.log.info(
      { migration: migration.file, version: migration.version },
      'migration applied',
    );
  }
}

/** Reads the files in order, refusing a bad name, a gap or a repeated number. */
function loadMigrations(dir: string): readonly Migration[] {
  const migrations = readdirSync(dir)
    .toSorted()
    .map((file) => ({
      version: parseVersion(file),
      file,
      sql: readFileSync(join(dir, file), 'utf8'),
    }));
  migrations.forEach((migration, index) => {
    checkNumber(migration, index + 1, migrations[index - 1]);
  });
  return migrations;
}

function parseVersion(file: string): number {
  const digits = MIGRATION_FILE.exec(file)?.[1];
  if (digits === undefined) {
    throw new Error(
      `Migration file ${file} isn't named NNNN_name.sql, like 0001_init.sql`,
    );
  }
  return Number(digits);
}

function checkNumber(
  migration: Migration,
  expected: number,
  previous: Migration | undefined,
): void {
  if (migration.version === expected) return;
  if (migration.version === previous?.version) {
    throw new Error(
      `Migrations ${previous.file} and ${migration.file} share the number ${padVersion(migration.version)}`,
    );
  }
  throw new Error(
    `Migration ${padVersion(expected)} is missing: the next file is ${migration.file}`,
  );
}

function padVersion(version: number): string {
  return String(version).padStart(VERSION_DIGITS, '0');
}

function readUserVersion(db: Database.Database): number {
  return userVersionSchema.parse(db.pragma('user_version', { simple: true }));
}

async function backUp(
  db: Database.Database,
  version: number,
  { backupsDir, clock, log }: MigrateOptions,
): Promise<void> {
  const file = backupFileName(version, clock());
  await db.backup(join(backupsDir, file));
  log.info({ backup: file }, 'database backed up');
}

/** pre-migration-v1-20261123T235107Z.db: UTC, without the colons Windows forbids. */
function backupFileName(version: number, instant: Temporal.Instant): string {
  const time = instant
    .toString({ smallestUnit: 'second' })
    .replaceAll(/[-:]/g, '');
  return `pre-migration-v${String(version)}-${time}.db`;
}

function applyMigration(
  db: Database.Database,
  { version, file, sql }: Migration,
): void {
  const apply = db.transaction(() => {
    db.exec(sql);
    checkForeignKeys(db);
    // PRAGMA values can't be bound (DATA-6), so this interpolates `version`:
    // the integer parsed from the file's checked NNNN name, never input.
    db.pragma(`user_version = ${String(version)}`);
  });
  // SQLite's table-rebuild procedure. PRAGMA foreign_keys does nothing inside
  // a transaction, and while it's on, DROP TABLE runs ON DELETE actions on the
  // child rows. So foreign keys are off for the file and checked before it
  // commits.
  db.pragma('foreign_keys = OFF');
  try {
    apply();
  } catch (error) {
    throw new Error(`Migration ${file} failed and was rolled back`, {
      cause: error,
    });
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/** Throws, naming the first broken reference, unless every foreign key holds. */
function checkForeignKeys(db: Database.Database): void {
  const broken = db.prepare(FIRST_BROKEN_FOREIGN_KEY_SQL).get();
  if (broken === undefined) return;
  const { table, parent } = brokenForeignKeySchema.parse(broken);
  throw new Error(
    `Foreign key broken: a row in ${table} points at a missing row in ${parent}`,
  );
}
