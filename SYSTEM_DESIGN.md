# Hafiza MVP System Design

## Goal

Build a high-performance, offline-first flashcard/spaced-repetition PWA
with no Hafiza backend. Core learning data stays on-device. Google Drive
is an optional user-controlled backup/sync provider.

> Local data is the source of truth from the user's perspective.

## Stack

-   TypeScript (strict)
-   React + Vite
-   PWA via vite-plugin-pwa / Workbox
-   IndexedDB via Dexie
-   OPFS/Blob storage for appropriate large files
-   Zustand/React for transient UI state
-   Zod validation
-   UUIDv7 IDs
-   isolated SRS scheduler
-   Google Drive adapter
-   Web Workers for heavy processing
-   Vitest + React Testing Library + Playwright
-   pnpm

## Architecture

``` text
HAFIZA PWA
│
├── UI: Today, Library, Deck, Study, Create, Import, Progress, Settings
├── Application: focused use cases
├── Domain: Card, Deck, Tag, ReviewEvent, StudySession, Scheduling, Sync rules
├── Ports: repositories, ImportAdapter, BackupProvider, SyncProvider
└── Infrastructure
    ├── Dexie / IndexedDB
    ├── OPFS / Web Workers
    ├── local file backup
    └── Google Drive
```

Dependency direction: `UI → Application → Domain`; infrastructure
implements inward-facing ports.

## Local-First Write Path

`User action → Use case → Domain logic → Local transaction → UI update → optional background sync`.

A study rating must never wait for Drive.

## Source Layout

``` text
src/
├── app/{router,providers,bootstrap,service-worker}
├── modules/
│   ├── today/
│   ├── library/
│   ├── decks/
│   ├── cards/
│   ├── study/
│   ├── progress/
│   ├── import/
│   └── sync/
└── shared/{ui,types,errors,validation,utils}
```

Feature modules may contain `domain`, `application`, `infrastructure`,
and `ui`. Expose public APIs through `index.ts`.

## Persistence Boundary

Use focused repository interfaces such as `CardRepository`; implement
them with Dexie for MVP. This keeps a future `SQLiteCardRepository`
possible without rewriting Study/Today/Library/Progress.

## Core Entities

Folder, Deck, Card, Tag, CardTag, ReviewEvent, StudySession,
StudySessionItem, DailyStudyStats, Attachment, SyncOperation, Device,
AppSettings.

Use collision-safe IDs. Editable synchronized entities carry stable ID,
timestamps, revision, updating device, and optional `deletedAt`.

Review history is append-only and records rating, time, previous/new
scheduling state, and device.

## SRS

Expose a pure `Scheduler.schedule(current, rating, reviewedAt)` domain
contract. UI never calculates intervals. Rating a card runs one local
transaction that appends ReviewEvent, updates Card scheduling,
session/stats, and sync metadata.

## Performance

Use indexed Dexie queries, pagination, pre-aggregated daily statistics,
thin UI state, and Web Workers for Anki/CSV/XLSX parsing, compression,
large validation, and heavy aggregation. Cache Storage holds application
assets, not flashcards.

## PWA

Offline must support opening the app, Today, Library, create/edit,
study, search, progress from local data, and local backup. Network is
optional for Drive. App shell/database initialization must not wait for
Drive.

## Backup

Use a versioned `.hafiza` format with `format`, `formatVersion`,
`appVersion`, `exportedAt`, and normalized data. Serialize and compress.
Manual and Drive backup reuse the same serializer.

## Google Drive

Treat Drive as a provider behind a `SyncProvider`/`BackupProvider`
interface. Recommended implementation sequence: 1. local `.hafiza`
export/import; 2. Drive full backup/restore; 3. incremental multi-device
sync; 4. conflict recovery/compaction.

For incremental sync, prefer per-device ordered change journals plus
cursors rather than every device rewriting one shared file.

## Conflicts

MVP rules: - ReviewEvent: append-only union. - StudySession:
append/merge where possible. - Card/Deck: deterministic newest valid
revision/update. - Tag: stable-ID merge. - Delete: newer tombstone
wins. - Settings: newest update wins. Use device ID as deterministic
tie-breaker. No CRDTs for MVP.

## Import

`File → Detect → Parse → Normalize → Map → Validate → Preview → User confirmation → Transaction → Database`.
Use adapters for CSV, XLSX, and Anki. Never commit before confirmation.

## Testing

Unit-test domain/SRS/conflict logic; integration-test repositories,
transactions, migrations, import, backup and sync; Playwright-test
critical user journeys.

## MVP Boundary

Core: onboarding/local profile, Today, Library, decks/cards, basic
tags/folders, SRS study, history, progress, CSV import, Anki if
feasible, `.hafiza` backup/restore, installable PWA, complete offline
workflow. Then Drive backup/restore, then incremental sync.

Commercial AI generation must not block the local MVP because provider
secrets cannot safely be hidden in a browser-only app.

## Decision

**React + TypeScript + Vite PWA → modular Clean/Hexagonal boundaries →
repository ports → Dexie/IndexedDB local source of truth → OPFS/Workers
where appropriate → versioned local backup → optional Google Drive
adapter. No Hafiza backend.**
