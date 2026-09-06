# Hafiza Features and Enhancement Roadmap

Hafiza is an offline-first flashcard and spaced-repetition PWA. IndexedDB is
the local source of truth; Google Drive is optional backup/synchronization.
AI-generated decks are intentionally outside the browser-only MVP because
provider secrets cannot be protected safely in client code.

## Current MVP features

### Application and navigation

- Today, Library, Deck, Create/Edit, Import, Study, Progress, and Settings
  screens.
- Responsive desktop sidebar and mobile bottom navigation.
- Keyboard-friendly controls, skip link, focus-visible styling, reduced-motion
  support, and Lucide icons.
- Local status, error, and recovery messaging.

### Local-first storage

- Dexie/IndexedDB persistence with versioned migrations.
- No Hafiza backend dependency.
- Local writes complete before optional network synchronization.
- Core learning remains usable offline.
- Typed UI → Application → Domain boundaries; React does not access Dexie
  directly.

### Decks, folders, and cards

- Automatic `Main Deck` for new profiles.
- Deck creation with validation.
- Optional folders and folder filtering.
- Library search, sorting, grid/list layouts, card totals, due counts, and
  workload indicators.
- Basic question/answer card creation and editing.
- Card deletion through synchronization-safe tombstones.
- Card search and scheduling-state filters.
- Incremental card loading with Load More for large decks.
- Character counts, live preview, and unsaved-editor protection.
- Rich question/answer editing with bold, italic, underline, highlight, lists,
  links, code blocks, superscript/subscript, undo/redo, keyboard shortcuts,
  and sanitized pasted markup.
- Offline LaTeX-style inline and block math rendering in previews and Study.
- Extensible card kinds: Basic, Basic + Reverse, Cloze, and Rich Media.
- Offline image/audio attachments with side selection, picker, drag/drop,
  clipboard paste, previews, replacement/removal, and browser microphone
  recording when supported.

### Spaced repetition and study

- Isolated scheduler with Again, Hard, Good, and Easy ratings.
- Deterministic due-card queues and deck-specific review.
- Reveal-before-rate study flow.
- Keyboard shortcuts: Space reveals; 1–4 rate the card.
- Semantic colors for rating actions.
- Atomic local review transaction updates the review event, schedule, session,
  statistics, and sync metadata.
- Review actions never wait for the network.
- Study progress and completion state.

### Progress and history

- Append-only review history.
- Daily reviewed-card counts, retention, and study-time aggregates.
- Activity and consistency views.
- Synchronized reviews are projected into local progress statistics.

### Import

- CSV and XLSX import.
- Web Worker parsing.
- `Question`/`Answer` and `Front`/`Back` column conventions.
- Optional semicolon- or pipe-separated tags.
- Invalid-row reporting.
- Preview and confirmation before commit.
- Transactional card, tag, and relationship writes.
- Anki CSV conversion guidance; direct `.apkg` parsing is not included.

### Backup and restore

- Versioned `.hafiza` export.
- Includes learning data, history, statistics, devices, sync metadata, and
  portable card media assets.
- Worker-based compression where supported.
- Zod validation and metadata preview.
- Transactional restore with rollback on interruption.
- Device identity is restored consistently with synchronization metadata.

### Google Drive and synchronization

- User-controlled OAuth connection with the minimal `drive.appdata` scope.
- Latest-backup upload/download.
- Per-device incremental journals.
- Journal compression, schema validation, cursors, and applied-operation
  tracking.
- Deterministic conflict resolution and bounded retries.
- Exact journal matching, Drive pagination, and conditional update protection.
- Drive failures do not block local learning.

### PWA, deployment, and quality

- Installable PWA manifest and Workbox app-shell caching.
- Offline reopening without placing learning data in Cache Storage.
- Netlify configuration with SPA redirects and security headers.
- GitHub Actions CI for install, typecheck, lint, formatting, tests, build, and
  Playwright.
- Vitest unit/integration tests and Playwright critical-flow coverage.

## Logical enhancements

These improvements fit the current architecture and should precede major new
features.

### Reliability and data safety

1. **Automatic pre-restore backup** — export the current local database before
   replacing it, protecting users from selecting an old or incorrect backup.
2. **Explicit restore identity policy** — distinguish same-device restore from
   importing a backup onto a new device and test both migration paths.
3. **Drive journal compaction** — checkpoint and compact old operations so
   journals do not grow without limit.
4. **Conflict recovery center** — show which revision won and offer recovery of
   the losing version.
5. **Multi-tab coordination** — use BroadcastChannel/Web Locks to coordinate
   restore, import, and sync operations.

### Library and study workflow

1. **Complete deck management** — rename, archive/delete, restore, and move
   decks between folders; add folder rename/delete.
2. **Stable default-deck setting** — replace name-only Main Deck identity with
   a persisted default deck ID.
3. **Study queue controls** — choose session size, explain queue limits, show
   remaining due cards, and resume unfinished sessions.
4. **Review undo** — provide a short-lived local undo after an accidental
   rating.
5. **Bulk card actions** — multi-select, move, tag, archive, and restore cards.
6. **Better loading and empty states** — add skeletons, retry buttons, and
   contextual next steps.

### Navigation and maintainability

1. **URL-addressable screens** — preserve deck, search, and card state across
   refresh; support browser back/forward and bookmarks.
2. **Incremental App decomposition** — extract Today, Library, Deck, Editor,
   Study, Import, Progress, and Settings from `src/app/App.tsx` without a
   broad rewrite.
3. **Controller hooks** — centralize async loading, stale-request protection,
   retries, and page-level state.
4. **Aggregate library queries** — replace measured N+1 deck count queries
   with indexed batch queries when library size warrants it.
5. **Accessibility refinement** — announce loading/sync transitions, add
   dropdown typeahead, and test with NVDA/VoiceOver and zoomed layouts.

### Learning value

1. **Deck analytics** — due trends, retention, mastered cards, difficult cards,
   and study time per deck.
2. **Difficult-card list** — surface cards repeatedly rated Again or Hard with
   direct edit/review actions.
3. **Duplicate detection** — warn about duplicate normalized questions during
   creation and import.
4. **Import quality tools** — progress for large files, duplicate preview,
   column mapping presets, and Anki CSV presets.
5. **Interoperability exports** — CSV export and optional printable study
   sheets.

## Future feature opportunities

### Medium enhancements

- Advanced cloze authoring (multiple targets and selection-to-cloze workflow).
- Image occlusion masks built on the existing media/card-type model.
- Custom study sessions with new/review limits.
- Saved searches and smart decks.
- Configurable scheduler settings.
- Theme and high-contrast modes.

### Major features

- Shared or collaborative decks.
- Account-based synchronization service.
- Full conflict/version history center.
- Rich card-type editor and media management.
- Advanced analytics and learning plans.
- Native wrappers after the PWA is stable.

### Experimental ideas

- Local-only semantic search without uploading card content.
- Adaptive daily workload recommendations.
- Detection of poorly written or repeatedly failed cards.
- Explanations for why a rating produced a particular interval.
- Privacy-preserving local personalization.

## Explicit MVP non-goals

- Commercial AI generation requiring protected API secrets.
- Custom Hafiza backend or microservices.
- Real-time collaboration or CRDT synchronization.
- Subscriptions and billing.
- Server-side storage of private learning content.
- SQLite-WASM migration without measured need.

## Recommended order

1. Finish restore safety, journal compaction, and conflict recovery.
2. Complete deck management and study-session controls.
3. Improve loading/error/retry states and URL navigation.
4. Decompose the application shell incrementally.
5. Add analytics, bulk actions, and import quality tools.
6. Validate demand for rich cards and collaboration before building them.
