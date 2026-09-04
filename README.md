# Hafiza

Hafiza is an offline-first flashcard and spaced-repetition progressive web
application. Learning data is stored locally in IndexedDB. Network access is
optional and is used only for user-initiated Google Drive backup and sync.

## Features

- Deck, folder, card, and tag organization
- Local SRS review sessions with Again, Hard, Good, and Easy ratings
- Keyboard review controls: Space reveals; 1–4 rate the card
- Review history and aggregated progress statistics
- CSV and XLSX import with validation and confirmation preview
- Compressed, versioned `.hafiza` backup and validated restore
- Optional Google Drive backup and per-device journal synchronization
- Installable PWA with offline reopening and study support

AI-generated decks are intentionally outside the MVP.

## Requirements

- Node.js 22 or newer
- pnpm 10.15.1, available through Corepack

## Getting started

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Commands

```bash
corepack pnpm dev          # Start the development server
corepack pnpm build        # Typecheck and create the production PWA
corepack pnpm preview      # Preview the production build
corepack pnpm typecheck    # Run strict TypeScript checks
corepack pnpm lint         # Run ESLint
corepack pnpm test         # Run Vitest tests
corepack pnpm e2e          # Run Playwright critical journeys
corepack pnpm format       # Format project files
corepack pnpm format:check # Verify formatting
```

## Architecture

Hafiza is a local-first modular monolith with the dependency direction:

```text
UI → Application → Domain
                  ↑
             Infrastructure
```

Feature code lives under `src/modules/<feature>` and exposes public APIs through
the module's `index.ts`. React components communicate through the application
port and never access Dexie or Google Drive directly.

IndexedDB is the local source of truth. Review mutations append an immutable
review event, update scheduling and daily statistics, and enqueue synchronization
metadata in one local transaction. The next card never waits for the network.

See [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md), [RULES.md](RULES.md), and
[TASKS.md](TASKS.md) for the detailed design and roadmap.

## Imports

CSV and XLSX files require `Question`/`Answer` or `Front`/`Back` headers. A
`Tags` column is optional and accepts semicolon- or pipe-separated values. Files
are parsed in a Web Worker and must be previewed before import.

Direct Anki `.apkg` parsing is not included because partial parsing can silently
lose note-model or media semantics. Export the desired Anki cards as CSV first.
See [IMPORT_SUPPORT.md](IMPORT_SUPPORT.md).

## Backup and restore

Settings provides a local `.hafiza` export containing decks, cards, history,
statistics, and sync metadata. The file is compressed in a worker. Restore
validates and previews the backup before replacing local learning data.

Keep backups in a safe location. Clearing browser storage without a backup can
remove the local database.

## Optional Google Drive setup

1. Create a Google OAuth web client and enable the Google Drive API.
2. Add the development and production origins as authorized JavaScript origins.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_GOOGLE_CLIENT_ID` to the public OAuth client ID.
5. Restart the development server.

Hafiza requests only the `drive.appdata` scope. Access tokens stay in memory;
they are not stored in IndexedDB. Local features continue working when Drive is
unconfigured or offline.

## Testing and data safety

Vitest covers domain behavior, repositories, migrations, imports, backup, and
sync. Playwright covers the create → study → progress journey and offline reopen.
Persistent schema changes must add a new Dexie version and migration test.

## Browser support

Use a current Chromium, Firefox, or Safari release with IndexedDB, Web Workers,
service workers, and CompressionStream support. PWA installation behavior varies
by browser and operating system.

## License

No license has been selected yet. Add a `LICENSE` file before public
redistribution.
