# ADR-0001: Record architecture decisions

Nov 23, 2026 · Ethan

## Status

Accepted

## Context

HomeHub is a family project that I'll maintain for years, and Claude Code writes most of its code. Each Claude Code session starts fresh (AI-3) and knows only what CLAUDE.md and the files in docs/ tell it, so a reason that isn't written down in the repository is a reason the next session can't see.

The design has already changed once in a big way: .NET, Aspire, PostgreSQL, Azure and OIDC sign-in gave way to one TypeScript stack, SQLite and Tailscale. The reasons for that move live in chats and pull-request threads that neither a new session nor I will reread. Without them, a sensible-looking suggestion, such as moving to PostgreSQL or adding a sign-in screen, could quietly undo a decision that was made on purpose. The project overview describes the current design, but not the alternatives that lost or why they lost.

## Decision

We will record each architecturally significant decision as an Architecture Decision Record (ADR) in docs/adr, in Michael Nygard's format ([Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)) with one addition. A decision is significant when it affects HomeHub's structure, non-functional qualities, dependencies, interfaces or construction techniques, or when it chooses between real alternatives.

- Each ADR is a Markdown file named `NNNN-short-title.md`. Numbers are sequential and never reused.
- Each ADR has the sections Status, Context, Decision, Alternatives considered and Consequences, and runs one or two pages of full sentences. Alternatives considered is the addition to Nygard's format, because DOC-1 requires it.
- The status is Proposed, Accepted, Deprecated or "Superseded by ADR-NNNN".
- An accepted ADR is never rewritten. A change of mind is a new ADR that supersedes the old one, and the old one's only edit is its status line.
- Claude Code may draft an ADR, but I accept it, in the pull request that makes the decision.

## Alternatives considered

**No formal record.** Decisions would live in commit messages, pull-request descriptions and chats. That costs nothing up front, but the reasons end up scattered, and a fresh Claude Code session won't dig through history to find them.

**Decisions in docs/project-overview.md.** The overview already describes the design, so keeping decisions there would avoid a second place to look. But the overview is edited in place to stay current, so the story of a reversal, and the options that lost, would disappear with each edit.

**Decisions outside the repository**, in the HomeHub claude.ai project, a wiki or GitHub issues. These aren't versioned or reviewed with the code, and Claude Code sessions in the repository can't see them.

**A richer template such as MADR.** MADR adds decision drivers and the pros and cons of each option. That suits teams that weigh many options together. For a one-person project, Nygard's sections plus Alternatives considered capture what matters with less ceremony.

## Consequences

Each significant decision now costs a short document, written in the same pull request as the change, so a decision and its reasons are reviewed and merged together.

Claude Code and future reviews have something concrete to check against. CLAUDE.md points Claude at docs/adr and tells it not to reverse a decision without proposing a new ADR, GEN-7 lets an ADR change an established pattern, and /standards-review treats contradicting an accepted ADR as a broken rule.

ADRs can drift from the code when a change ignores them. The pull-request template asks whether an ADR needs updating, and DOC-6 keeps the overview and CLAUDE.md in step, which keeps that gap small.

The rest of the overview's Decision records list follows as separate ADRs, starting in step 1.10.
