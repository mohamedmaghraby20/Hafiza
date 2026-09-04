import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CreateCardUseCase,
  DeleteCardUseCase,
  DexieCardRepository,
  EditCardUseCase,
  RestoreCardUseCase,
} from "@modules/cards";
import { CreateDeckUseCase, DexieDeckRepository } from "@modules/decks";
import { LibraryQueries } from "@modules/library";
import { FixedClock, UuidV7IdGenerator } from "@shared/index";
import { HafizaDatabase } from "@shared/infrastructure/database";
import { createCardFixture, createDeckFixture } from "@test/domainFixtures";

describe("deck and card application use cases", () => {
  const ids = new UuidV7IdGenerator();
  const clock = new FixedClock(new Date("2026-09-04T08:00:00.000Z"));
  const deviceId = ids.next();
  let database: HafizaDatabase;
  let decks: DexieDeckRepository;
  let cards: DexieCardRepository;

  beforeEach(() => {
    database = new HafizaDatabase(`use-case-test-${ids.next()}`);
    decks = new DexieDeckRepository(database);
    cards = new DexieCardRepository(database);
  });

  afterEach(async () => database.delete());

  it("creates a deck and card, edits revision metadata, and queries the library", async () => {
    const deckResult = await new CreateDeckUseCase(decks, clock, ids).execute({
      name: "Arabic",
      deviceId,
    });
    expect(deckResult.ok).toBe(true);
    if (!deckResult.ok) return;

    const cardResult = await new CreateCardUseCase(
      cards,
      decks,
      clock,
      ids,
    ).execute({
      deckId: deckResult.value.id,
      front: "Hello",
      back: "مرحبا",
      deviceId,
    });
    expect(cardResult.ok).toBe(true);
    if (!cardResult.ok) return;

    const editResult = await new EditCardUseCase(cards, clock).execute({
      id: cardResult.value.id,
      front: "Hello!",
      back: "مرحبا",
      deviceId,
    });
    expect(editResult.ok && editResult.value.revision).toBe(2);

    const library = new LibraryQueries(decks, cards);
    const result = await library.listDecks(
      { offset: 0, limit: 20 },
      clock.now(),
    );
    expect(result.items[0]).toMatchObject({ cardCount: 1, dueCount: 1 });
    expect(
      (await library.searchCards({ text: "hell", offset: 0, limit: 10 })).total,
    ).toBe(1);
  });

  it("uses tombstones and permits recovery", async () => {
    const deck = await new CreateDeckUseCase(decks, clock, ids).execute({
      name: "Recovery",
      deviceId,
    });
    if (!deck.ok) throw deck.error;
    const card = await new CreateCardUseCase(cards, decks, clock, ids).execute({
      deckId: deck.value.id,
      front: "Front",
      back: "Back",
      deviceId,
    });
    if (!card.ok) throw card.error;

    await new DeleteCardUseCase(cards, clock).execute({
      id: card.value.id,
      deviceId,
    });
    expect(await cards.findById(card.value.id)).toBeNull();
    await new RestoreCardUseCase(cards, clock).execute({
      id: card.value.id,
      deviceId,
    });
    expect(await cards.findById(card.value.id)).not.toBeNull();
  });

  it("counts a large due deck with indexes without truncating its summary", async () => {
    const deck = createDeckFixture({ id: ids.next(), name: "Large deck" });
    await decks.save(deck);
    const records = Array.from({ length: 1_201 }, (_, index) => {
      const card = createCardFixture(deck.id, {
        id: ids.next(),
        front: `Question ${index}`,
      });
      return {
        ...card,
        active: 1 as const,
        dueAt: card.scheduling.dueAt,
        normalizedFront: card.front.toLocaleLowerCase(),
      };
    });
    await database.cards.bulkPut(records);

    const [total, due] = await Promise.all([
      cards.countByDeck(deck.id),
      cards.countDue(clock.now(), deck.id),
    ]);

    expect(total).toBe(1_201);
    expect(due).toBe(1_201);
  });
});
