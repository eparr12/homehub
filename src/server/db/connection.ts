import Database from 'better-sqlite3';

// DATA-5's settings. PRAGMA values can't be bound, so they're constants
// (DATA-6).
const CONNECTION_PRAGMAS = [
  'journal_mode = WAL',
  'synchronous = NORMAL',
  'foreign_keys = ON',
  'busy_timeout = 5000',
] as const;

// A primary-key read of the one sync_state row, so the check needs the real
// file and the migrated schema. SELECT 1 would pass without reading either.
const CHECK_SQL = 'SELECT version FROM sync_state WHERE id = 1';

/** The outcome of checkDatabase: ok, or the error that the query threw. */
export type DatabaseCheck =
  { readonly ok: true } | { readonly ok: false; readonly error: unknown };

/** Opens the SQLite database at `filename` (or ':memory:') with the DATA-5 settings. */
export function openDatabase(filename: string): Database.Database {
  const db = new Database(filename);
  for (const pragma of CONNECTION_PRAGMAS) {
    db.pragma(pragma);
  }
  return db;
}

/** Runs one cheap query to show whether the database can still be read (OBS-6). */
export function checkDatabase(db: Database.Database): DatabaseCheck {
  try {
    db.prepare(CHECK_SQL).get();
    return { ok: true };
  } catch (error) {
    // Returned, not thrown: a failed check is a status to report, and the
    // caller logs it once (OBS-3).
    return { ok: false, error };
  }
}
