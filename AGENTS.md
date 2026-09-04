# AGENTS.md --- Hafiza AI Engineering Instructions

## Mission

Build Hafiza quickly without sacrificing local-first architecture, data
safety, performance, or maintainability. Hafiza is an offline-first
flashcard and spaced-repetition PWA. The MVP has no Hafiza backend:
IndexedDB/Dexie is the local source of truth and Google Drive is
optional backup/synchronization.

Read `SYSTEM_DESIGN.md`, `RULES.md`, and `TASKS.md` before architectural
work.

## Non-Negotiable Architecture

`UI → Application → Domain`, with Infrastructure implementing ports
defined by Domain/Application.

-   Domain is framework-agnostic.
-   Components never access Dexie directly.
-   Use cases never access Google Drive directly.
-   Save locally before syncing.
-   Never block study UX on the network.
-   Review events are append-only.
-   Synchronized deletions use tombstones.
-   Heavy parsing/compression belongs in Web Workers where appropriate.

## Workflow for Every Task

Before coding: 1. Read the task and acceptance criteria. 2. Identify the
owning module. 3. Inspect existing public interfaces and
implementations. 4. Reuse existing components/use cases before creating
new ones. 5. Identify persistence, migration, sync, and test impact. 6.
Make the smallest implementation plan that satisfies the task.

During coding: 1. Keep changes scoped. 2. Follow existing naming/module
structure. 3. Depend on abstractions at application/domain boundaries.
4. Reuse existing types/schemas. 5. Keep UI thin and business rules
below it. 6. Use transactions for related persistent mutations. 7.
Preserve offline behavior. 8. Add/update tests with behavior.

Before finishing: 1. Run TypeScript typecheck. 2. Run relevant
unit/integration tests. 3. Run lint. 4. Run relevant Playwright tests
for critical-flow changes. 5. Check no Dexie/Drive dependency leaked
into UI/domain. 6. Check migrations if persistence changed. 7. Summarize
files, decisions, tests, and remaining risks.

## Forbidden Shortcuts

Do not create a backend for MVP features; introduce microservices;
access Dexie directly from React; call Drive directly from
study/card/deck use cases; wait for sync before completing local
actions; mirror the database in Zustand; use `any` as a shortcut;
silently swallow errors; physically delete synchronized records
immediately; rewrite released migrations; import cards without
preview/confirmation; add CRDT/CQRS/global event sourcing without an
approved need; perform unrelated refactors; or expose secrets in client
code.

## Module Template

``` text
modules/<feature>/
├── domain/
├── application/
├── infrastructure/
├── ui/
└── index.ts
```

Expose module APIs through `index.ts`. Never deep-import another
module's internals.

## Naming

Prefer `ReviewCardUseCase`, `CardRepository`, `DexieCardRepository`,
`GoogleDriveSyncProvider`, and `CsvImportAdapter`. Avoid vague
`Manager`, `Helper`, `DataService`, `common`, or giant `utils` files.

## Data Safety Checklist

For persistent changes verify stable IDs, transactions, migrations,
tombstones, backup compatibility, sync implications, restore
compatibility, and regression tests. Data loss is a release blocker.

## Performance Checklist

Ask whether the change loads full tables, misses an index, creates
unnecessary global state, performs expensive main-thread work, delays
startup on optional services, waits for sync during study, or repeatedly
scans raw history. Optimize the study path first.

## Testing Priorities

Highest risk: SRS, review transactions, migrations, backup/restore,
import, and sync/conflict resolution. Use Vitest for domain logic,
integration tests for persistence, and Playwright for critical journeys.

## Architecture Change Protocol

If a request conflicts with `SYSTEM_DESIGN.md` or `RULES.md`, do not
bypass it silently. Explain the conflict, propose the smallest
decision/change, record it, then implement.

## Completion Report

``` text
Implemented:
- ...

Changed:
- ...

Tests:
- ...

Architecture:
- no boundary changes
  OR decision recorded: ...

Remaining:
- ...
```
