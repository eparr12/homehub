-- The sync version: every grocery push bumps it and stamps the new value on
-- each row it changes (SYNC-5). CHECK (id = 1) keeps the table to one row.
CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL
) STRICT;

INSERT INTO sync_state (id, version) VALUES (1, 0);
