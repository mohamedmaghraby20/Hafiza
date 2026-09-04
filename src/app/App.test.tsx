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

afterEach(cleanup);

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
    const question = screen.getByPlaceholderText(
      "Type the question or prompt…",
    );
    const answer = screen.getByPlaceholderText("Write the answer…");
    expect(question).toHaveValue(card.front);
    expect(answer).toHaveValue(card.back);

    await user.clear(answer);
    await user.type(answer, "The mitochondrion");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(editCard).toHaveBeenCalledWith(
      card.id,
      card.front,
      "The mitochondrion",
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
});
