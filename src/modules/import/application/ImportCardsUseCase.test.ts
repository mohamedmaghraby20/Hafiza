import { afterEach, describe, expect, it } from "vitest";

import { CreateCardUseCase, DexieCardRepository } from "@modules/cards";
import { DexieDeckRepository } from "@modules/decks";
import { DexieCardTagRepository, DexieTagRepository } from "@modules/library";
import { FixedClock, UuidV7IdGenerator } from "@shared/index";
import {
  DexieTransactionRunner,
  HafizaDatabase,
} from "@shared/infrastructure/database";
import { createDeckFixture, testIds, testInstant } from "@test/domainFixtures";

import { ImportCardsUseCase } from "./ImportCardsUseCase";

describe("ImportCardsUseCase recovery", () => {
  const databases: HafizaDatabase[] = [];

  afterEach(async () => {
    await Promise.all(databases.map((database) => database.delete()));
    databases.length = 0;
  });

  it("rolls back cards, tags, and links when an import is interrupted", async () => {
    const database = new HafizaDatabase(`import-rollback-${testIds.next()}`);
    databases.push(database);
    const ids = new UuidV7IdGenerator();
    const clock = new FixedClock(testInstant);
    const decks = new DexieDeckRepository(database);
    const cards = new DexieCardRepository(database);
    const tags = new DexieTagRepository(database);
    const deck = createDeckFixture();
    await decks.save(deck);
    const useCase = new ImportCardsUseCase(
      new CreateCardUseCase(cards, decks, clock, ids),
      new DexieTransactionRunner(database),
      tags,
      new DexieCardTagRepository(database),
      clock,
      ids,
    );

    await expect(
      useCase.execute(
        {
          fileName: "interrupted.csv",
          issues: [],
          cards: [
            { front: "Valid", back: "First", tags: ["new"], row: 2 },
            { front: "", back: "Invalid", tags: ["other"], row: 3 },
          ],
        },
        deck.id,
        testIds.next(),
      ),
    ).rejects.toThrow();

    expect(
      (await cards.listByDeck(deck.id, { offset: 0, limit: 10 })).total,
    ).toBe(0);
    expect(await tags.list()).toHaveLength(0);
    expect(await database.cardTags.count()).toBe(0);
  });
});
