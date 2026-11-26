# ADR-0005: Intent outbox sync with a counter version

Nov 25, 2026 · Ethan

## Status

Accepted

## Context

The grocery list has to work in the back of a store with no signal and sync by itself when service returns, on both phones and the wall, without losing anything. The phones reach the server only over the tailnet (ADR-0004), which drops in a dead zone, and iOS Safari has no Background Sync API, so a phone can sync only while the app is open.

Phase 2 builds this, in build-plan steps 2.1 to 2.8, so this record holds a design and not a result. All that's on main so far is the sync_state table, with its one counter row at version 0 (#3). The design is the overview's Grocery sync design and its dead-zone walk-through. Step 2.8's real shopping trip with no signal is the Phase 2 gate, and the design's proof.

## Decision

Every client, the wall included, writes to its local Dexie database first and syncs through an outbox:

- **Intents, not rows.** A change is recorded as an intent: AddItem, MarkPurchased, NeedAgain, SetQuantity, EditNotes or DeleteItem (SYNC-2). The change and its outbox entry are saved in one Dexie transaction, and nothing in that transaction waits on the network (SYNC-1).
- **One reducer.** A single function in src/shared defines what each intent does. The client applies changes locally with it and the server applies them with it too, so the two can't disagree (SYNC-3).
- **Each mutation applies once.** Every intent carries a mutationId, a UUIDv7 that the client makes, which doubles as the idempotency key. The server records each mutationId with its result, so a retried push is never applied twice (SYNC-4).
- **Push.** POST /api/grocery/sync/push applies a batch of mutations in order, in one SQLite transaction, and returns applied, duplicate or rejected for each. The transaction bumps the single counter row in sync_state and stamps every row it changes with the new version (SYNC-5).
- **Pull.** GET /api/grocery/sync/pull?since={version} returns every row changed after the client's cursor, with deleted rows as tombstones (SYNC-6), and the new cursor. The client then re-applies its unsent intents on top of the server's rows, so its local changes aren't overwritten (SYNC-8).
- **A nudge, not data.** After a commit that changed something, GET /api/events sends every connected client a `changed` event with no row data, at most the latest version, and the client pulls (SYNC-7).
- **When it syncs.** The outbox flushes shortly after each local change, on the online event, on visibilitychange, on a 30-second heartbeat while the app is open, and when a "pull now" event arrives.
- **What fails, and how.** A rejected change, such as checking off an item someone deleted, leaves the outbox and shows in the UI. Network errors and 5xx responses retry with backoff, and nothing retries forever (SYNC-9).

The counter is what keeps a cursor from skipping a row. SQLite allows one writer at a time, and better-sqlite3 runs each transaction synchronously, so versions are committed strictly in order, as long as the bump and the writes share one transaction (ADR-0003).

The overview's walk-through puts the pieces together. At home, someone taps Eggs on the wall, which writes the item and an AddItem intent locally and pushes it, and the server commits version 1042 and sends every connected device a "pull now" event. In the back of the store, with no signal, the shopper checks off Milk, and the phone queues a MarkPurchased intent without sending anything. In the parking lot, the phone's Tailscale reconnects, and its sync manager pushes MarkPurchased, pulls everything since its cursor, Eggs included, and re-applies anything still queued. The wall gets the nudge, pulls, and shows Milk checked off.

## Alternatives considered

**Whole rows overwritten in place of intents.** A device would send each item as it last saw it, and the newest copy would win, overwriting whatever another device had changed in the meantime. The server, seeing only rows, couldn't apply a change through the shared reducer, or reject one for a reason, such as checking off an item someone deleted.

**A per-row sequence as the cursor.** Each row would take the next number from a sequence as it's written. A number handed out at write time can commit after a higher one, so a cursor can skip a row that commits late, which is the risk the first design's PostgreSQL sequences carried (ADR-0003). One counter, bumped inside the write transaction, commits in order.

**The Background Sync API**, which lets a browser send the outbox after the app has closed. iOS Safari lacks it, so the design syncs while the app is open, on the triggers above.

**Row data inside the server's events**, in place of a "pull now" with no content. Data would then reach clients two ways. With a contentless nudge, it always travels through the pull endpoint, the one tested path.

## Consequences

The design commits Phase 2 to the SYNC rules, SYNC-1 to SYNC-11, and every sync change ships with tests: Vitest for the reducer and for the client with fake-indexeddb, server tests against a real SQLite database, and Playwright's offline scenarios (SYNC-11). Among what the rules hold it to:

- **Synced rows are soft-deleted, never hard-deleted** (SYNC-6), so tombstones stay, and a new device's first pull brings them along.
- **Mutation shapes stay backward compatible.** A field can be added as optional, but never renamed or removed, because a phone may hold unsent entries from an older version of the app (SYNC-10).
- **A phone syncs only while HomeHub is open on it**, so its unsent changes wait for the next time it's opened.

I'd come back to the design if:

- Step 2.8's real trip shows a problem that a fix within the SYNC rules can't solve.
- HomeHub needs a second process writing to the database, or a database without SQLite's one writer at a time, because the counter's order rests on it (ADR-0003).
- An intent has to change in a way that adding an optional field can't express.
