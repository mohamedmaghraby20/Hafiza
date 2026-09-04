# Performance budgets and measurements

Hafiza records browser Performance API measures without logging card content.
Open browser developer tools and inspect **Performance → User timing** after
using the relevant flow.

| Measure                     | Target on a typical current laptop | Implementation                                        |
| --------------------------- | ---------------------------------: | ----------------------------------------------------- |
| `hafiza.startup`            |                       under 500 ms | Indexed deck page, indexed counts, aggregate progress |
| `hafiza.library.load`       |         under 300 ms for 100 decks | paged decks and compound IndexedDB indexes            |
| `hafiza.study.rate-to-next` |                       under 100 ms | one local transaction; network is not awaited         |
| `hafiza.import.parse`       |     no main-thread task over 50 ms | CSV/XLSX Web Worker                                   |
| `hafiza.import.commit`      |          under 1 s for 1,000 cards | one rollback-safe transaction                         |
| `hafiza.backup.export`      |     no main-thread task over 50 ms | compression Web Worker                                |
| `hafiza.progress.load`      |                       under 150 ms | pre-aggregated daily statistics                       |

The large-library integration fixture verifies that summaries remain exact past
1,000 due cards. Repository counts use compound indexes and no longer load due
card records merely to count them.

These are release budgets, not universal guarantees: IndexedDB speed varies by
device and browser. Investigate any repeated measurement above budget before a
release, prioritizing `hafiza.study.rate-to-next` and startup.
