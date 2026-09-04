# MVP Release Checklist

## Automated gate

- [x] Strict TypeScript typecheck
- [x] ESLint with zero warnings
- [x] Prettier formatting check
- [x] Vitest unit and integration suite
- [x] Production PWA build
- [x] Playwright create, study, progress, and offline-reopen journey
- [x] Playwright CSV import and transactional backup-restore journey
- [x] Playwright mobile navigation, skip-link, and overflow checks

## Data safety

- [x] IndexedDB v1 through v4 migration coverage
- [x] Review event, schedule, statistics, and sync metadata are transactional
- [x] Import and restore failures roll back without partial writes
- [x] Restore validates and previews the backup before replacement
- [x] Synchronized deletions use tombstones
- [x] Sync cursors advance only after a successful transactional apply
- [x] Corrupt journals and entity payloads are rejected
- [x] No known data-loss issue in the covered MVP flows

## Offline and deployment

- [x] App shell and local study reopen offline in Playwright
- [x] Network sync is optional and never blocks local review
- [x] Netlify build, publish, SPA fallback, and cache headers are configured
- [x] GitHub Actions runs the full release gate for pull requests and `main`
- [ ] Configure the production Google OAuth origin, if Drive is enabled
- [ ] Review the Netlify Deploy Preview on desktop and a physical phone
- [ ] Complete the manual screen-reader and contrast checks in
      [ACCESSIBILITY.md](ACCESSIBILITY.md)
- [ ] Export and retain a pre-release `.hafiza` recovery backup from any
      important test profile

The unchecked items require production credentials, a physical device, or
human assistive-technology review and should be completed by the release owner.
