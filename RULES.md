# Hafiza Engineering Rules

## Architecture

1.  Hafiza is a local-first modular monolith.
2.  Dependency direction is `UI → Application → Domain`; infrastructure
    implements ports.
3.  Domain must not import React, Dexie, IndexedDB, Google APIs,
    Zustand, Workbox, or browser-specific APIs.
4.  No custom Hafiza backend or microservices for the MVP.
5.  Never bypass architecture boundaries for speed.

## Modules

1.  Every feature has a clear owning module.
2.  Modules expose public APIs through `index.ts`.
3.  Never deep-import another module's internals.
4.  Prefer explicit feature/use-case names over generic
    helpers/services.

## Data

1.  React components never access Dexie directly.
2.  Persistent reads/writes use repositories/application queries.
3.  Related multi-record writes use transactions.
4.  IndexedDB is the MVP local source of truth.
5.  Never mirror the whole database in Zustand.
6.  Use indexed queries/pagination instead of loading entire tables.
7.  Persistent schema changes require new versioned migrations; never
    rewrite released migrations.

## Local-First

1.  Core learning works offline.
2.  Save locally first.
3.  Study never blocks on Drive/network.
4.  Sync is optional/asynchronous.
5.  Network failure never makes local study data unavailable.

## SRS

1.  Scheduling is domain logic, never UI logic.
2.  Review events are immutable/append-only.
3.  A rating atomically appends the review, updates scheduling, updates
    derived stats, and enqueues sync metadata when enabled.
4.  SRS behavior requires unit tests.

## Sync

1.  Google Drive is an adapter, not the primary database.
2.  Application/domain use cases never call Drive APIs directly.
3.  Synchronizable mutations generate sync operations.
4.  Deletes use tombstones.
5.  Use deterministic MVP conflict rules; no CRDTs unless later
    justified.
6.  Build local backup/restore before incremental sync.

## Backup

1.  Use a versioned `.hafiza` backup format.
2.  Manual and Drive backup share serialization logic.
3.  Preserve recovery paths: soft delete, restore, conflict copy, safe
    migrations, emergency export.
4.  Never silently discard learning data.

## Performance

1.  Critical study operations are local-only.
2.  Never await sync/analytics before showing the next card.
3.  Startup never waits for Drive.
4.  Use Web Workers for expensive parsing/compression/large
    calculations.
5.  Pre-aggregate common progress metrics.
6.  Store large binary attachments appropriately outside normal entity
    rows.
7.  Add indexes for measured/real queries, not speculation.

## State

-   IndexedDB: persistent learning data.
-   React/Zustand: transient UI state.
-   Selectors/queries: derived state.
-   Cache Storage: PWA app assets only.
-   OPFS/Blob: large local attachments where appropriate.

## TypeScript

1.  `strict` mode is mandatory.
2.  Avoid `any`; isolate/document unavoidable external-boundary cases.
3.  Validate untrusted data with Zod/equivalent.
4.  Prefer discriminated unions and typed errors.
5.  Map external DTOs to domain types.

## SOLID

-   Single Responsibility: separate scheduling, persistence, sync,
    import, analytics, UI.
-   Open/Closed: extend via adapters/strategies.
-   Liskov: implementations obey replaceable contracts.
-   Interface Segregation: focused repositories/providers, no giant
    database service.
-   Dependency Inversion: high-level behavior depends on abstractions.

## Import

1.  Formats implement a common adapter.
2.  Heavy parsing/validation runs in workers when beneficial.
3.  Always preview before commit.
4.  Commit accepted imports transactionally.
5.  Invalid external input must never corrupt the DB.

## Errors

Use typed application errors; translate infrastructure failures at
boundaries; do not scatter generic catches/alerts; preserve data and
recovery options.

## Testing

Domain logic gets unit tests; repositories/database get integration
tests; critical flows get Playwright tests. Every bug fix should add a
regression test when practical. Prioritize SRS, transactions,
migrations, backup/restore, import, and sync.

## Dependencies

Prefer mature focused packages and native solutions where sufficient.
Avoid unnecessary frameworks, heavy CQRS, global event sourcing, DI
frameworks, and microservices.

## Security/Privacy

Never expose commercial provider secrets in client code. Request minimal
Drive permissions. Treat imports/sync payloads as untrusted. Do not
unnecessarily log private card content or send learning data to third
parties.

## Definition of Done

Acceptance criteria pass; typecheck/lint/relevant tests pass;
architecture boundaries remain intact; migrations exist for persistent
schema changes; no known data-loss path is introduced; important
decisions are documented.
