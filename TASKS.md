# Hafiza MVP Agent Task Plan

Complete in dependency order. Keep the app runnable after every phase.
Follow `SYSTEM_DESIGN.md`, `RULES.md`, and `AGENTS.md`.

## Phase 0 --- Foundation

-   [x] **T000 Workspace:** pnpm + React/TypeScript/Vite, strict TS,
    aliases, build/dev scripts.
-   [x] **T001 Quality:** ESLint, formatting, Vitest, RTL, Playwright,
    typecheck/lint/test/e2e scripts.
-   [x] **T002 CI:** install → typecheck → lint → unit tests → build.
-   [x] **T003 Structure:** establish `app/modules/shared`, feature
    public APIs, import-boundary convention.

## Phase 1 --- Domain

-   [x] **T010 Primitives:** UUIDv7 abstraction, deterministic clock
    where useful, typed results/errors, validation primitives.
-   [x] **T011 Deck:** entity/invariants/repository port/tests.
-   [x] **T012 Card:** entity, Basic card, scheduling placeholder,
    repository port, validation/tests.
-   [x] **T013 Tag/Folder:** domain models, required
    relationships/ports/tests.
-   [x] **T014 Review/Session:** immutable ReviewEvent,
    StudySession/Item, ports/tests.

## Phase 2 --- Local Database

-   [x] **T020 Dexie v1:** bootstrap, schema/indexes, migration
    convention, integration test.
-   [x] **T021 Deck repo:** Dexie implementation, soft delete, indexed
    queries/tests.
-   [x] **T022 Card repo:** Dexie implementation, due/deck queries, soft
    delete/tests.
-   [x] **T023 Review/session repos:** append-only review and session
    persistence/tests.
-   [x] **T024 Tag/folder repos:** persistence/tests.
-   [x] **T025 Transactions:** application-safe atomic transaction
    abstraction + rollback tests.

## Phase 3 --- Deck/Card Use Cases

-   [x] **T030 Create deck:** validation/use case/tests.
-   [x] **T031 Create card:** validation/use case/tests.
-   [x] **T032 Edit card:** revision/update metadata/tests.
-   [x] **T033 Delete/restore card:** tombstones + tests.
-   [x] **T034 Library queries:** deck list/summary, card pagination,
    basic search/filter without full-table loads.

## Phase 4 --- SRS/Study

-   [x] **T040 Scheduler contract:** Rating, SchedulingState/Result,
    deterministic fixtures.
-   [x] **T041 MVP scheduler:** isolated implementation + comprehensive
    Again/Hard/Good/Easy tests.
-   [x] **T042 ReviewCardUseCase:** atomic review + schedule + session +
    stats + sync metadata; rollback tests; no network.
-   [x] **T043 Study queue:** due selection, deck filter, deterministic
    ordering.
-   [x] **T044 Study session service:** start, next, reveal/rate,
    complete + tests.

## Phase 5 --- Core UI

-   [x] **T050 Design foundations:** tokens, typography, spacing,
    semantic study colors, accessible core components.
-   [x] **T051 Shell/nav:** Today, Library, Progress, Settings;
    responsive.
-   [x] **T052 Today:** due count, workload estimate, Start Review,
    Continue Learning, quick actions.
-   [x] **T053 Library:** search, deck list, filters, create/import
    entry.
-   [x] **T054 Deck:** summary, paginated cards, Start Review,
    create/edit entry.
-   [x] **T055 Create/Edit Card:** manual editor, preview, validation,
    save/update.
-   [x] **T056 Study UI:** question/reveal/answer/ratings, shortcuts,
    progress/completion; rating never waits for network.

## Phase 6 --- Progress

-   [x] **T060 DailyStudyStats:** model/repository/schema/tests.
-   [x] **T061 Stats transaction:** update atomically with review.
-   [x] **T062 Progress:** reviewed cards, retention, study time,
    activity, deck progress using aggregates.

## Phase 7 --- Import

-   [x] **T070 Contracts:** ImportAdapter, normalized model, mapping,
    validation, typed errors.
-   [x] **T071 Worker pipeline:** detect/parse/normalize/validate
    worker + tests.
-   [x] **T072 CSV:** mapping, malformed-row reporting/tests.
-   [x] **T073 XLSX:** parser/mapping/tests.
-   [x] **T074 Anki:** feasibility first; implement/document supported
    subset if stable.
-   [x] **T075 Import UI:** file → mapping → preview/errors →
    confirmation → atomic commit.

## Phase 8 --- PWA/Offline

-   [x] **T080 Manifest/installability:** manifest/icons/config.
-   [x] **T081 Service worker:** app-shell caching/update
    strategy/offline startup; no learning data in Cache Storage.
-   [x] **T082 Offline suite:** reopen, Today, Library, create/edit,
    study, progress, local backup all work offline.

## Phase 9 --- Local Backup

-   [x] **T090 Backup schema:** versioned Zod
    schema/serializers/compatibility tests.
-   [x] **T091 Export:** snapshot + compression worker + `.hafiza`
    generation/tests.
-   [x] **T092 Restore:** validation, preview/confirmation,
    transactional restore, failure recovery/tests.
-   [x] **T093 Backup UI:** Export, Restore, metadata.

## Phase 10 --- Google Drive Backup

-   [x] **T100 Provider ports:** backup/sync contracts, connection
    state, typed errors.
-   [x] **T101 Drive authorization:** user-driven connect/disconnect
    with minimal permissions.
-   [x] **T102 Drive backup provider:** upload/download latest `.hafiza`
    snapshot, metadata, mocked adapter tests.
-   [x] **T103 Drive UI:** Connect, Backup/Sync Now, last status,
    Restore, Disconnect; app remains usable when Drive fails.

## Phase 11 --- Incremental Multi-Device Sync

**Do not start until local and Drive backup/restore are stable.**

-   [x] **T110 Device identity:** stable device ID/metadata/tests.
-   [x] **T111 SyncOperation:** ordered local operations, status/retry
    persistence/tests.
-   [x] **T112 Enqueue changes:** cards/decks/tags/reviews/tombstones.
-   [ ] **T113 Drive journal:** per-device ordered journal, cursor
    metadata, compression/schema.
-   [x] **T114 Push:** batched/idempotent upload/retry/tests.
-   [x] **T115 Pull:** discover/download unseen operations,
    validation/cursors/tests.
-   [ ] **T116 Conflicts:** deterministic rules with comprehensive tests.
-   [x] **T117 Remote apply:** transactional apply; cursor advances only
    after success; rollback tests.
-   [ ] **T118 Orchestration:** manual Sync Now + online-triggered
    non-blocking sync/status/retry.

## Phase 12 --- Hardening

-   [x] **T120 Migration tests:** upgrade from every released schema.
-   [ ] **T121 Recovery:** quota, corrupt backup, interrupted
    import/restore/sync.
-   [ ] **T122 Performance:** measure startup, Today, large Library,
    rating→next, import, backup, Progress; optimize measured
    bottlenecks.
-   [ ] **T123 Accessibility:** keyboard, focus, contrast, labels,
    reduced motion, screen readers.
-   [ ] **T124 E2E:** create→study→progress; offline reopen; import;
    export/restore; Drive backup; multi-device sync when shipped.
-   [ ] **T125 Release:** typecheck/lint/tests/build pass, PWA/offline
    verified, no known data-loss issue, backup restore verified, docs
    current.

## Deferred / Post-MVP

Commercial AI generation requiring protected secrets,
collaboration/shared decks, real-time collaboration, CRDTs, custom
backend, advanced analytics, SQLite-WASM migration, native wrappers,
subscriptions.
