import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeTempDir, openTestDatabase } from '../test-support.ts';

describe('openDatabase', () => {
  // A file, because an in-memory database can't use WAL.
  it('applies the DATA-5 settings to a database file', () => {
    const db = openTestDatabase(join(makeTempDir(), 'homehub.db'));

    const settings = {
      journalMode: db.pragma('journal_mode', { simple: true }),
      synchronous: db.pragma('synchronous', { simple: true }),
      foreignKeys: db.pragma('foreign_keys', { simple: true }),
      busyTimeout: db.pragma('busy_timeout', { simple: true }),
    };

    // synchronous reads back as a number: 1 is NORMAL.
    expect(settings).toEqual({
      journalMode: 'wal',
      synchronous: 1,
      foreignKeys: 1,
      busyTimeout: 5000,
    });
  });
});
