import { describe, expect, it } from "vitest";

import { LocalHafizaApplication } from "./LocalHafizaApplication";

describe("LocalHafizaApplication default deck", () => {
  it("creates Main Deck and routes an unassigned card there", async () => {
    const application = new LocalHafizaApplication();

    const initialDecks = await application.loadLibrary();
    expect(initialDecks).toHaveLength(1);
    expect(initialDecks[0]).toMatchObject({
      name: "Main Deck",
      cardCount: 0,
    });

    await application.createCard(undefined, "A question", "An answer");

    const decks = await application.loadLibrary();
    expect(decks[0]).toMatchObject({ name: "Main Deck", cardCount: 1 });
    await expect(application.loadCards(decks[0]!.id)).resolves.toHaveLength(1);
  });

  it("stores rich card types and offline media separately from card content", async () => {
    const application = new LocalHafizaApplication();
    await application.createCard(undefined, "$x^2$", "Four", {
      kind: "rich-media",
      frontFormat: "rich",
      backFormat: "rich",
      assets: [
        {
          kind: "image",
          name: "formula.png",
          mimeType: "image/png",
          data: "data:image/png;base64,ZmFrZQ==",
          size: 20,
        },
      ],
    });

    const decks = await application.loadLibrary();
    const cards = await application.loadCards(decks[0]!.id);
    expect(cards.at(-1)).toMatchObject({
      kind: "rich-media",
      front: "$x^2$",
      frontFormat: "rich",
      assets: [{ name: "formula.png", kind: "image" }],
    });
  });
});
