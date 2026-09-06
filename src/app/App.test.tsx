import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  App,
  type HafizaAppPort,
  type LibraryCard,
  type LibraryDeck,
} from "./App";

function createApplication(
  overrides: Partial<HafizaAppPort> = {},
): HafizaAppPort {
  return {
    loadLibrary: () => Promise.resolve([]),
    loadFolders: () => Promise.resolve([]),
    loadCards: () => Promise.resolve([]),
    loadCardsPage: () => Promise.resolve({ items: [], total: 0 }),
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
      Promise.resolve({ fileName, cards: [], issues: [] }),
    previewXlsx: (fileName) =>
      Promise.resolve({ fileName, cards: [], issues: [] }),
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
    syncIfConnected: () => Promise.resolve(null),
    subscribeSyncStatus: (listener) => {
      listener({
        phase: "idle",
        message: "Local data is up to date",
        lastSyncedAt: null,
      });
      return () => undefined;
    },
    disconnectDrive: () => undefined,
    ...overrides,
  };
}

const deck: LibraryDeck = {
  id: "biology",
  name: "Biology",
  cardCount: 1,
  dueCount: 1,
  folderId: null,
};

const card: LibraryCard = {
  id: "cell-card",
  deckId: deck.id,
  front: "What powers a cell?",
  back: "Mitochondria",
  phase: "new",
  dueAt: new Date("2026-09-04T00:00:00.000Z"),
};

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "#");
});

describe("App", () => {
  it("renders the local-first dashboard", async () => {
    render(<App application={createApplication()} />);

    expect(
      screen.getByRole("heading", { name: "Good morning." }),
    ).toBeVisible();
    expect(
      await screen.findByText("Create your first deck to begin."),
    ).toBeVisible();
  });

  it("edits a card in the create-style editor", async () => {
    const user = userEvent.setup();
    const editCard = vi.fn(() => Promise.resolve());
    render(
      <App
        application={createApplication({
          loadLibrary: () => Promise.resolve([deck]),
          loadCards: () => Promise.resolve([card]),
          loadCardsPage: () => Promise.resolve({ items: [card], total: 1 }),
          editCard,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.click(
      await screen.findByRole("button", { name: /Biology.*1 cards/s }),
    );
    await user.click(await screen.findByRole("button", { name: "Edit" }));

    expect(screen.getByRole("heading", { name: "Edit card" })).toBeVisible();
    const question = screen.getByRole("textbox", {
      name: "Question / Front",
    });
    const answer = screen.getByRole("textbox", { name: "Answer / Back" });
    expect(question).toHaveTextContent(card.front);
    expect(answer).toHaveTextContent(card.back);

    await user.clear(answer);
    await user.type(answer, "The mitochondrion");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(editCard).toHaveBeenCalledWith(
      card.id,
      card.front,
      "The mitochondrion",
      expect.objectContaining({
        kind: "basic",
        frontFormat: "rich",
        backFormat: "rich",
      }),
    );
  });

  it("shows the Figma review colors and keeps primary navigation visible", async () => {
    const user = userEvent.setup();
    render(
      <App
        application={createApplication({
          loadLibrary: () => Promise.resolve([deck]),
          startStudy: () =>
            Promise.resolve({
              sessionId: "session",
              itemId: "study-item",
              current: 1,
              total: 1,
              card,
            }),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start review" }));
    await user.click(
      await screen.findByRole("button", { name: "Show answer" }),
    );

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Again/ })).toHaveClass(
      "bg-[#fae3de]",
    );
    expect(screen.getByRole("button", { name: /Hard/ })).toHaveClass(
      "bg-[#f7edd4]",
    );
    expect(screen.getByRole("button", { name: /Good/ })).toHaveClass(
      "bg-[#e3f2e8]",
    );
    expect(screen.getByRole("button", { name: /Easy/ })).toHaveClass(
      "bg-[#e5edfa]",
    );
  });

  it("explains how to recover when browser storage is full", async () => {
    const user = userEvent.setup();
    render(
      <App
        application={createApplication({
          createDeck: () =>
            Promise.reject(
              new DOMException("Storage quota reached", "QuotaExceededError"),
            ),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.type(screen.getByLabelText("New deck"), "Large deck");
    await user.click(screen.getAllByRole("button", { name: "Add" })[0]!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Export a backup",
    );
  });

  it("reports a corrupt backup instead of replacing local data", async () => {
    const user = userEvent.setup();
    render(
      <App
        application={createApplication({
          decodeBackupFile: () => Promise.reject(new Error("Invalid gzip")),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.upload(
      screen.getByLabelText("Choose a Hafiza backup"),
      new File(["broken"], "broken.hafiza", {
        type: "application/gzip",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid gzip");
  });

  it("backs up to Drive on demand and syncs again when connectivity returns", async () => {
    const user = userEvent.setup();
    const backupToDrive = vi.fn(() => Promise.resolve());
    const syncIfConnected = vi.fn(() =>
      Promise.resolve({ pushed: 1, pulled: 2 }),
    );
    render(
      <App
        application={createApplication({
          driveEnabled: () => true,
          backupToDrive,
          syncIfConnected,
        })}
      />,
    );

    window.dispatchEvent(new Event("online"));
    expect(syncIfConnected).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Backup to Drive" }));

    expect(backupToDrive).toHaveBeenCalledOnce();
    expect(await screen.findByText("Backup uploaded.")).toBeVisible();
  });
});
