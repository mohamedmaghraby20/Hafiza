import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the local-first dashboard", async () => {
    render(
      <App
        application={{
          loadLibrary: () => Promise.resolve([]),
          loadFolders: () => Promise.resolve([]),
          loadCards: () => Promise.resolve([]),
          createDeck: () => Promise.resolve(),
          createFolder: () => Promise.resolve(),
          createCard: () => Promise.resolve(),
          editCard: () => Promise.resolve(),
          deleteCard: () => Promise.resolve(),
          startStudy: () =>
            Promise.resolve({
              sessionId: "session",
              itemId: null,
              current: 0,
              total: 0,
              card: null,
            }),
          revealStudy: () => Promise.resolve(),
          rateStudy: () =>
            Promise.resolve({
              sessionId: "session",
              itemId: null,
              current: 0,
              total: 0,
              card: null,
            }),
          loadProgress: () =>
            Promise.resolve({
              reviewedCards: 0,
              retentionPercent: 0,
              studyTimeMs: 0,
              days: [],
            }),
          previewCsv: (fileName) =>
            Promise.resolve({
              fileName,
              cards: [],
              issues: [],
            }),
          previewXlsx: (fileName) =>
            Promise.resolve({
              fileName,
              cards: [],
              issues: [],
            }),
          importCards: () => Promise.resolve(0),
          exportBackup: () => Promise.resolve("{}"),
          exportBackupFile: () => Promise.resolve(new ArrayBuffer(0)),
          decodeBackupFile: () => Promise.resolve("{}"),
          inspectBackup: () => ({
            exportedAt: new Date(0).toISOString(),
            deckCount: 0,
            cardCount: 0,
          }),
          restoreBackup: () => Promise.resolve(),
          driveEnabled: () => false,
          backupToDrive: () => Promise.resolve(),
          restoreFromDrive: () => Promise.resolve(),
          syncNow: () => Promise.resolve({ pushed: 0, pulled: 0 }),
          disconnectDrive: () => undefined,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Good morning." }),
    ).toBeVisible();
    expect(
      await screen.findByText("Create your first deck to begin."),
    ).toBeVisible();
  });
});
