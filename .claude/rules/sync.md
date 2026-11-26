---
paths:
  - "src/shared/grocery/**"
  - "src/server/features/grocery/**"
  - "src/web/data/**"
---

# Sync

The sync rules, and what the sync code has taught us. Claude Code loads this file when it reads a file under one of the paths above: the grocery schemas and reducer, the server's grocery feature and the web app's data layer. The design lives in docs/project-overview.md, under Grocery sync design, and in ADR-0005 (docs/adr/0005-intent-outbox-sync-with-a-counter-version.md).

## SYNC-1 to SYNC-11

Each line is its rule in docs/coding-standards.md's own words, cut short, because a rule restated in new words drifts. Wherever a line says less than its rule, the standards win.

- **SYNC-1** Every local change and its outbox entry are written in one Dexie transaction, and nothing inside a Dexie transaction awaits the network.
- **SYNC-2** Mutations express intent, never whole-row overwrites.
- **SYNC-3** The intent reducer in src/shared is the only definition of what each intent does; the client and the server both call it.
- **SYNC-4** Every mutation carries a client-generated UUIDv7 mutationId, and the server applies each mutationId at most once.
- **SYNC-5** The sync_state version bump and the data writes share one SQLite transaction, and every row the transaction changes is stamped with the new version.
- **SYNC-6** Synced rows are soft-deleted (is_deleted = 1) so pulls return tombstones; they are never hard-deleted.
- **SYNC-7** Server-Sent Events carry no row data, only a signal to pull.
- **SYNC-8** After a pull, unsent intents are re-applied on top of the server's rows (rebase).
- **SYNC-9** A rejected mutation leaves the outbox and is shown in the UI; it is never retried forever. Network errors and 5xx responses retry with backoff; a 4xx response or a rejected result does not.
- **SYNC-10** Mutation shapes stay backward compatible: add optional fields, but never rename or remove one.
- **SYNC-11** Every sync change ships with tests: Vitest for the reducer and the client, server tests against a real SQLite database, and the Playwright offline scenarios still pass.

## What the code has taught us

- **One spelling.** Lowercase UUIDv7 IDs, and instants with three fraction digits. Temporal's default `toString()` drops trailing zeros from the fraction (`.500` becomes `.5`, and a whole second loses it all), so write `toString({ fractionalSecondDigits: 3 })` or `Date#toISOString`, and test any code that writes an instant with a whole second.
- **Use what the schema returned.** It trims names and notes and drops unknown fields, so apply and store its output, never its input. That output is frozen, and what applyIntent builds isn't, so nothing may count on a write throwing.
- **Only the server's answer is final.** On a client, applyIntent's refusal is a preview: after a push whose answer was lost, the pull brings the item back and replaying AddItem on it is item-exists, while the server will answer duplicate. Replaying any other intent on its own result is no change. Both were tried in the prototype. An entry leaves the outbox on the server's result alone (SYNC-9).
- **The caller names the actor.** An intent never says who made it.
- **Lists and limits only grow.** The categories, the reasons and the field limits are in rows and outboxes already. Growing them is safe for the server, which reads old intents and old rows. It isn't yet for a phone on an older version, which meets a newer server after every deploy, and whose item schema refuses a key or a length it doesn't know. Step 2.4 decides how a pull is read.
- **A new intent needs a case.** applyIntent's switch has no default branch, so an intent added to the union fails the typecheck (TS2366) until it has a case. It also needs a row in the overview's What each intent does and a test for each cell of that row.
- **The clock lint has gaps.** src/shared's lint refuses the usual reads of a clock or a random source, but not `const { now } = Date`, `globalThis.Date.now()` or a `Date` under another name. A time comes from the intent's occurredAt because the code is written that way, not because the lint stops it.
