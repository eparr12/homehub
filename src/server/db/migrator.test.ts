import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it, onTestFinished } from 'vitest';
import { captureLogs, makeTempDir, openTestDatabase } from '../test-support.ts';
import { migrate } from './migrator.ts';

type Migrations = Readonly<Record<string, string>>;

const NOW = Temporal.Instant.from('2026-11-23T23:51:07.123Z');
const BACKUP_FILE = 'pre-migration-v1-20261123T235107Z.db';
const CREATE_ITEMS: Migrations = {
  '0001_create_items.sql':
    'CREATE TABLE items (id INTEGER PRIMARY KEY) STRICT;',
};
const ADD_ITEM: Migrations = {
  '0002_add_item.sql': 'INSERT INTO items (id) VALUES (1);',
};
// A parent with two child rows that the database deletes along with it.
const CREATE_FAMILY: Migrations = {
  '0001_create_family.sql': `
    CREATE TABLE parents (id INTEGER PRIMARY KEY) STRICT;
    CREATE TABLE children (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER NOT NULL REFERENCES parents (id) ON DELETE CASCADE
    ) STRICT;
    INSERT INTO parents (id) VALUES (1);
    INSERT INTO children (id, parent_id) VALUES (1, 1), (2, 1);`,
};
// SQLite's table rebuild: create the new table, copy, drop the old, rename.
const REBUILD_PARENTS: Migrations = {
  '0002_rebuild_parents.sql': `
    CREATE TABLE new_parents (id INTEGER PRIMARY KEY, name TEXT) STRICT;
    INSERT INTO new_parents (id) SELECT id FROM parents;
    DROP TABLE parents;
    ALTER TABLE new_parents RENAME TO parents;`,
};

/** A new in-memory database with its own migration and backup folders. */
function setUp(migrations: Migrations) {
  const root = makeTempDir();
  const migrationsDir = join(root, 'migrations');
  const backupsDir = join(root, 'backups');
  mkdirSync(migrationsDir);
  mkdirSync(backupsDir);
  addMigrations(migrationsDir, migrations);
  const db = openTestDatabase(':memory:');
  const logs = captureLogs();
  const run = () =>
    migrate(db, { migrationsDir, backupsDir, clock: () => NOW, log: logs.log });
  return { db, migrationsDir, backupsDir, logs, run };
}

function addMigrations(dir: string, migrations: Migrations): void {
  for (const [file, sql] of Object.entries(migrations)) {
    writeFileSync(join(dir, file), sql);
  }
}

/** Opens a backup read-only, so checking it can't change it. */
function openBackup(path: string): Database.Database {
  const backup = new Database(path, { readonly: true, fileMustExist: true });
  onTestFinished(() => {
    backup.close();
  });
  return backup;
}

function userVersion(db: Database.Database): unknown {
  return db.pragma('user_version', { simple: true });
}

function itemIds(db: Database.Database): unknown[] {
  return db.prepare('SELECT id FROM items ORDER BY id').pluck().all();
}

function parentIds(db: Database.Database): unknown[] {
  return db.prepare('SELECT id FROM parents ORDER BY id').pluck().all();
}

function childIds(db: Database.Database): unknown[] {
  return db.prepare('SELECT id FROM children ORDER BY id').pluck().all();
}

function foreignKeys(db: Database.Database): unknown {
  return db.pragma('foreign_keys', { simple: true });
}

function tableNames(db: Database.Database): unknown[] {
  return db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
    .pluck()
    .all();
}

describe('migrate', () => {
  it('applies pending migrations in order and records the newest number in user_version', async () => {
    const { db, run } = setUp({ ...CREATE_ITEMS, ...ADD_ITEM });

    await run();

    expect({ version: userVersion(db), items: itemIds(db) }).toEqual({
      version: 2,
      items: [1],
    });
  });

  it('does nothing when no migration is pending', async () => {
    const { db, backupsDir, run } = setUp(CREATE_ITEMS);
    await run();

    // Running 0001 again would throw, because its table already exists.
    await run();

    expect({
      version: userVersion(db),
      backups: readdirSync(backupsDir),
    }).toEqual({ version: 1, backups: [] });
  });

  it('backs up the database before applying a pending migration', async () => {
    const { migrationsDir, backupsDir, run } = setUp(CREATE_ITEMS);
    await run();
    addMigrations(migrationsDir, ADD_ITEM);

    await run();

    expect(readdirSync(backupsDir)).toEqual([BACKUP_FILE]);
  });

  // DATA-10's restore test: the backup opens, passes integrity_check and
  // holds the state from before the migration, not after it.
  it('keeps the pre-migration state in the backup', async () => {
    const { migrationsDir, backupsDir, run } = setUp(CREATE_ITEMS);
    await run();
    addMigrations(migrationsDir, ADD_ITEM);

    await run();

    const backup = openBackup(join(backupsDir, BACKUP_FILE));
    expect({
      integrity: backup.pragma('integrity_check', { simple: true }),
      version: userVersion(backup),
      items: itemIds(backup),
    }).toEqual({ integrity: 'ok', version: 1, items: [] });
  });

  it('skips the backup for a new database', async () => {
    const { backupsDir, run } = setUp(CREATE_ITEMS);

    await run();

    expect(readdirSync(backupsDir)).toEqual([]);
  });

  it('rolls back a failing migration and leaves user_version alone', async () => {
    const { db, migrationsDir, run } = setUp(CREATE_ITEMS);
    await run();
    addMigrations(migrationsDir, {
      '0002_break.sql':
        'INSERT INTO items (id) VALUES (1); INSERT INTO missing (id) VALUES (1);',
    });

    await expect(run()).rejects.toThrow('0002_break.sql');

    expect({ version: userVersion(db), items: itemIds(db) }).toEqual({
      version: 1,
      items: [],
    });
  });

  it('keeps the child rows when a migration rebuilds their parent table', async () => {
    const { db, migrationsDir, run } = setUp(CREATE_FAMILY);
    await run();
    addMigrations(migrationsDir, REBUILD_PARENTS);

    await run();

    expect({ children: childIds(db), foreignKeys: foreignKeys(db) }).toEqual({
      children: [1, 2],
      foreignKeys: 1,
    });
  });

  it('rolls back a migration that leaves a child row without its parent', async () => {
    const { db, migrationsDir, run } = setUp(CREATE_FAMILY);
    await run();
    addMigrations(migrationsDir, {
      '0002_delete_parent.sql': 'DELETE FROM parents WHERE id = 1;',
    });

    await expect(run()).rejects.toMatchObject({
      message: 'Migration 0002_delete_parent.sql failed and was rolled back',
      cause: {
        message:
          'Foreign key broken: a row in children points at a missing row in parents',
      },
    });

    expect({
      version: userVersion(db),
      parents: parentIds(db),
      children: childIds(db),
      foreignKeys: foreignKeys(db),
    }).toEqual({ version: 1, parents: [1], children: [1, 2], foreignKeys: 1 });
  });

  it('leaves a database that is newer than the migrations unchanged', async () => {
    const { db, backupsDir, run } = setUp(CREATE_ITEMS);
    db.pragma('user_version = 3');

    await run();

    expect({
      version: userVersion(db),
      tables: tableNames(db),
      backups: readdirSync(backupsDir),
    }).toEqual({ version: 3, tables: [], backups: [] });
  });

  it('warns when the database is newer than the migrations', async () => {
    const { db, logs, run } = setUp(CREATE_ITEMS);
    db.pragma('user_version = 3');

    await run();

    expect(logs.lines).toEqual([
      {
        level: 'warn',
        version: 3,
        newest: 1,
        msg: 'database is newer than the migrations',
      },
    ]);
  });

  it('refuses migrations with a gap in their numbers', async () => {
    const { run } = setUp({ ...CREATE_ITEMS, '0003_add_item.sql': '' });

    await expect(run()).rejects.toThrow('0002 is missing');
  });

  it('refuses two migrations with the same number', async () => {
    const { run } = setUp({ ...CREATE_ITEMS, '0001_create_more.sql': '' });

    await expect(run()).rejects.toThrow(
      '0001_create_items.sql and 0001_create_more.sql',
    );
  });

  it('refuses a file that is not named NNNN_name.sql', async () => {
    const { run } = setUp({ ...CREATE_ITEMS, '0002-add-item.sql': '' });

    await expect(run()).rejects.toThrow('0002-add-item.sql');
  });
});
