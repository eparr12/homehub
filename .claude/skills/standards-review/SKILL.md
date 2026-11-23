---
name: standards-review
description: Review the branch diff against main, or the files and folders you pass, against docs/coding-standards.md. Reports findings grouped by severity, each with a rule ID, file and line.
argument-hint: "[path ...]"
disable-model-invocation: true
disallowed-tools: Edit Write NotebookEdit
---

# Standards review

Review HomeHub code against docs/coding-standards.md and report what you find. This is a review, not a fix: your file-editing tools are off for this turn, so don't change files any other way either, don't commit or push, and don't run the app or the test suites (the author's checks and CI cover those, AI-4).

Paths to review (empty means the branch diff): $ARGUMENTS

## 1. Decide the scope

- **No paths:** review what this branch changes, `git diff main...HEAD`. Start with `git diff --stat main...HEAD` and `git log --oneline main..HEAD`, then go file by file with `git diff main...HEAD -- <file>`. If the diff is empty, say so and stop. If `git status --short` shows uncommitted changes, say at the top of the report that they weren't reviewed.
- **Paths:** review those files as they are now, in full, whether or not this branch changed them. Expand folders with `git ls-files -- <paths>`, so ignored files never enter the review.
- Never open .env files or anything in data/, even when a path points there.

## 2. Read the rules and the context

- Read docs/coding-standards.md. It's the only rulebook, and its rules are MUST unless marked (SHOULD).
- Read every ADR in docs/adr. Contradicting an accepted ADR without a new ADR that supersedes it breaks DOC-1 and GEN-7.
- For each feature the code touches, read its section of docs/project-overview.md.
- Read each file in full, not only the changed hunks, and open its callers, callees and tests as needed to judge it.

## 3. Review

Work through the checklist in the standards' Code reviews section, in its order: correctness, security, sync safety, tests, architecture, AI hygiene, readability, performance. In particular, look for:

- tests that were weakened, skipped, focused with `.only` or deleted (TEST-10), and new logic or bug fixes without tests (TEST-1, TEST-2)
- library APIs that aren't used elsewhere in the repo: check each against the installed types in node_modules, because an invented API is a Blocker (AI-10)
- package.json or lockfile changes without a stated reason (AI-8, GEN-9)
- design, command or layout changes without matching updates to docs/project-overview.md and CLAUDE.md (DOC-6)
- in diff mode, the branch name (GIT-2, from `git branch --show-current`) and each commit subject (GIT-3)

Skip formatting and anything else Prettier, ESLint or tsc enforces.

## 4. Check each finding before you report it

For every finding, re-read the code at the cited line and confirm that:

- the problem is real in this code, not hypothetical;
- the cited rule says what the finding claims; and
- the line number is current: the line at HEAD, or for a deleted line, its line in main, written as `main:path:line`.

Drop any finding that fails a check. Report each problem once, at its most important location, and mention where else it occurs.

## 5. Report

Severity comes from the standards' Code reviews table:

- **Blocker:** a bug, security hole, data-loss risk, invented API or broken MUST rule.
- **Should fix:** a broken SHOULD rule or a clear maintainability problem.
- **Nit:** small polish the tools don't catch.
- **Praise:** something done well that's worth repeating.

Every finding cites one rule ID (the most specific), a file and a line. A finding about the branch name or a commit message cites the branch or the commit's short SHA instead of a file and line. A plain bug that no rule names cites `Correctness` (checklist item 1) rather than a stretched rule.

Keep all four headings in this order, and write "None." under an empty one:

```markdown
## Standards review: <branch> vs main (or: <paths>)

<scope: N files, +A/-D lines; uncommitted changes not reviewed, if any>

### Blocker

- **SYNC-1** `src/web/data/actions.ts:42`: <the problem and what it causes>. Fix: <the change>.

### Should fix

None.

### Nit

- **DOC-2** `src/server/app.ts:17`: <the problem>. Fix: <the change>.

### Praise

- **TEST-4** `src/shared/grocery/reducer.test.ts:10`: <what was done well>.

**Verdict:** Not ready: fix 1 Blocker
```

End with the verdict, following the table's "Before merge" column:

- `Not ready: fix N Blockers` when there's any Blocker;
- otherwise `Ready once each Should fix is fixed or has a linked issue` when there's any Should fix;
- otherwise `Ready to merge`.
