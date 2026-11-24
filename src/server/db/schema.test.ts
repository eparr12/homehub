import { describe, expect, it } from 'vitest';
import { openMigratedDatabase } from '../test-support.ts';

interface TableInfo {
  readonly name: string;
  readonly strict: number;
}

// GLOB, not LIKE: in LIKE, the underscore in sqlite_ is a wildcard.
const USER_TABLES_SQL = `
  SELECT name, strict FROM pragma_table_list
  WHERE schema = 'main' AND type = 'table' AND name NOT GLOB 'sqlite_*'`;

describe('the migrations', () => {
  it('make every table STRICT', async () => {
    const db = await openMigratedDatabase();

    const tables = db.prepare<[], TableInfo>(USER_TABLES_SQL).all();

    // Seeing sync_state proves the query finds the tables it checks.
    expect(tables.map((table) => table.name)).toContain('sync_state');
    expect(tables.filter((table) => table.strict !== 1)).toEqual([]);
  });

  it('start sync_state with one row at version 0', async () => {
    const db = await openMigratedDatabase();

    const rows = db.prepare('SELECT id, version FROM sync_state').all();

    expect(rows).toEqual([{ id: 1, version: 0 }]);
  });

  it('keep sync_state from holding a second row', async () => {
    const db = await openMigratedDatabase();
    const insertSecondRow = db.prepare(
      'INSERT INTO sync_state (id, version) VALUES (2, 0)',
    );

    expect(() => insertSecondRow.run()).toThrow('CHECK constraint failed');
  });
});
