# Accessibility

Hafiza targets WCAG 2.2 AA for the MVP. Accessibility is part of the normal
release gate, not an optional presentation layer.

## Implemented behavior

- A keyboard-visible skip link moves focus to the main content.
- Primary navigation exposes a label and `aria-current` state on the active
  destination.
- Interactive controls use visible focus indicators and a minimum 44-pixel
  target height where they are reused throughout the interface.
- Form fields have programmatic labels, validation messages remain visible,
  and operation results are announced through status or alert regions.
- Study progress uses progressbar semantics. The changing card area uses a
  polite live region.
- Study is fully keyboard operable: Space reveals the answer and 1, 2, 3, or 4
  selects Again, Hard, Good, or Easy.
- Confirmation dialogs expose dialog, title, description, and modal semantics;
  the primary action receives focus and Escape closes the dialog.
- Motion is removed when `prefers-reduced-motion: reduce` is active.
- Layouts support a 320-pixel minimum viewport, browser zoom, and the mobile
  bottom navigation without horizontal overflow.

## Release checks

Before release, complete these manual checks in addition to the automated
Playwright keyboard and mobile tests:

1. Navigate Today, Library, Create, Progress, and Settings using only Tab,
   Shift+Tab, Enter, and Space.
2. Run a study session using only Space and number keys.
3. Verify card deletion and backup restore dialogs with a screen reader and
   confirm focus does not become lost after closing.
4. Check text, focus, and review-rating colors with a WCAG contrast checker.
5. Test at 200% browser zoom and with reduced motion enabled.
6. Check VoiceOver or NVDA announcements for status, errors, and study changes.
