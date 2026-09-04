import type { Card } from "@modules/cards";
import type { Deck } from "@modules/decks";
import { FixedClock, UuidV7IdGenerator, type EntityId } from "@shared/index";

export const testInstant = new Date("2026-09-04T08:00:00.000Z");
export const testClock = new FixedClock(testInstant);
export const testIds = new UuidV7IdGenerator();

export function createDeckFixture(overrides: Partial<Deck> = {}): Deck {
  return {
    id: testIds.next(),
    name: "Languages",
    description: "",
    folderId: null,
    createdAt: testInstant,
    updatedAt: testInstant,
    revision: 1,
    updatedByDeviceId: testIds.next(),
    deletedAt: null,
    ...overrides,
  };
}

export function createCardFixture(
  deckId: EntityId,
  overrides: Partial<Card> = {},
): Card {
  return {
    id: testIds.next(),
    deckId,
    kind: "basic",
    front: "Question",
    back: "Answer",
    scheduling: {
      phase: "new",
      dueAt: testInstant,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
    },
    createdAt: testInstant,
    updatedAt: testInstant,
    revision: 1,
    updatedByDeviceId: testIds.next(),
    deletedAt: null,
    ...overrides,
  };
}
