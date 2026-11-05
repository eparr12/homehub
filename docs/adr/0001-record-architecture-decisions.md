# ADR-0001: Record architecture decisions

Date: 2026-11-04

## Status

Accepted

## Context

HomeHub is built by one developer over many months, in public, as both a household app and a portfolio project. Its design already rests on choices between real alternatives: a Dexie outbox over TanStack Query's offline mutations, a counter row over a database sequence for sync versions, Aspire for the move from Azure to a home NAS, and no MediatR or MinIO for licensing reasons. The reasons for those choices live in chat threads, planning documents and memory.

Two forces pull against each other. Reasons that are never written down get lost, and a later change can quietly undo a decision whose reason is gone; a plain sequence looks simpler than the counter row until it skips a row. Documentation that is heavy to write gets skipped, though, and a solo project has no reviewer to insist on it.

The repository is public. Reviewers and interviewers should be able to see why HomeHub is built the way it is, not only what it does.

## Decision

We will record each architecturally significant decision in an architecture decision record (ADR), using the format Michael Nygard describes in [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

- Each ADR is a Markdown file in docs/adr, named NNNN-short-title.md and numbered in sequence. Numbers are never reused.
- Each ADR has Nygard's sections: title, status, context, decision and consequences. We add an Alternatives considered section, which the [Coding Standards](../coding-standards.md) require (DOC-1). Status sits at the top so a reader sees first whether the record is in force.
- An ADR is Proposed while its pull request is open and Accepted when it merges. A later ADR can mark it Deprecated, or Superseded by ADR-NNNN.
- An accepted ADR is never rewritten. To change a decision, we write a new ADR that supersedes it and change only the old record's status line.
- An ADR merges in the same pull request as the change it describes, so one review covers both.
- A decision is significant when it chooses between real alternatives and affects structure, dependencies, data, security, deployment or cost, or would be expensive to reverse.
- New ADRs start from [template.md](template.md).

## Alternatives considered

- **No written record.** Commit messages, pull request descriptions and memory would carry the reasons. Rejected because reasons scatter across hundreds of commits, and nothing shows which decisions are still in force.
- **Decisions inside the Project Overview.** Rejected because the Overview describes the current design and is edited in place, so the history of each change, and the options that lost, would disappear.
- **A longer template, such as MADR.** Rejected for now because its extra sections, such as decision drivers and the pros and cons of each option, are more than a one-person project needs. Nygard's sections plus a short list of alternatives cover what DOC-1 asks for.
- **A wiki.** Rejected because a wiki is not versioned with the code or reviewed in pull requests.

## Consequences

- Each significant decision costs a short document, written while the reasoning is fresh, usually in the same pull request as the code.
- The history of decisions, reversals included, lives in the repository, where it is versioned and reviewed like code.
- Superseded ADRs stay in place, so the record shows how the design evolved.
- The next records are already known: ADR-0002 covers applying database migrations at startup (build step 1.3), and the Project Overview lists the others.
- ADRs can still be skipped or go stale. The pull request template asks whether an ADR changed, and every code review checks it.
