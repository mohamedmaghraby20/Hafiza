import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";

import { DexieCardRepository } from "@modules/cards";
import { DexieDeckRepository } from "@modules/decks";
import {
  DexieCardTagRepository,
  DexieFolderRepository,
  DexieTagRepository,
  type Folder,
  type Tag,
} from "@modules/library";
import {
  DexieReviewRepository,
  DexieStudySessionRepository,
} from "@modules/study";
import { ConflictError } from "@shared/index";
import {
  createCardFixture,
  createDeckFixture,
  testIds,
  testInstant,
} from "@test/domainFixtures";

import { DexieTransactionRunner } from "./DexieTransactionRunner";
import { HafizaDatabase } from "./HafizaDatabase";

describe("Dexie repositories", () => {
  let database: HafizaDatabase;

  beforeEach(() => {
    database = new HafizaDatabase(`hafiza-test-${testIds.next()}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it("creates the complete current schema", async () => {
    await database.open();
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      "appliedSyncOperations",
      "cardTags",
      "cards",
      "dailyStats",
      "decks",
      "devices",
      "folders",
      "reviews",
      "sessionItems",
      "sessions",
      "syncOperations",
      "tags",
    ]);
  });

  it("persists, queries, tombstones, and restores decks and cards", async () => {
    const decks = new DexieDeckRepository(database);
    const cards = new DexieCardRepository(database);
    const deck = createDeckFixture();
    const card = createCardFixture(deck.id);
    await decks.save(deck);
    await cards.save(card);

    expect((await decks.list({ offset: 0, limit: 10 })).total).toBe(1);
    expect(
      (await cards.listByDeck(deck.id, { offset: 0, limit: 10 })).items,
    ).toHaveLength(1);
    expect(await cards.listDue(testInstant, deck.id)).toHaveLength(1);

    const deletionTime = new Date("2026-09-05T08:00:00.000Z");
    await decks.softDelete(deck.id, deletionTime, testIds.next());
    expect(await decks.findById(deck.id)).toBeNull();
    expect((await decks.findById(deck.id, true))?.deletedAt).toEqual(
      deletionTime,
    );
    await decks.restore(deck.id, deletionTime, testIds.next());
    expect(await decks.findById(deck.id)).not.toBeNull();

    await cards.softDelete(card.id, deletionTime, testIds.next());
    expect(await cards.findById(card.id)).toBeNull();
    expect((await cards.findById(card.id, true))?.deletedAt).toEqual(
      deletionTime,
    );
    expect(await cards.listDue(deletionTime, deck.id)).toHaveLength(0);

    await cards.restore(card.id, deletionTime, testIds.next());
    expect(await cards.findById(card.id)).not.toBeNull();
  });

  it("persists taxonomy relationships", async () => {
    const tags = new DexieTagRepository(database);
    const folders = new DexieFolderRepository(database);
    const links = new DexieCardTagRepository(database);
    const tag: Tag = {
      ...createDeckFixture(),
      id: testIds.next(),
      name: "Geography",
    };
    const folder: Folder = {
      ...createDeckFixture(),
      id: testIds.next(),
      name: "School",
      parentId: null,
    };
    const cardId = testIds.next();
    await tags.save(tag);
    await folders.save(folder);
    await links.replaceForCard(cardId, [
      { cardId, tagId: tag.id, createdAt: testInstant },
    ]);
    expect(await tags.findById(tag.id)).toMatchObject({ name: "Geography" });
    expect(await folders.findById(folder.id)).toMatchObject({ name: "School" });
    expect(await tags.list()).toHaveLength(1);
    expect(await folders.list()).toHaveLength(1);
    expect(await links.listForCard(cardId)).toHaveLength(1);
  });

  it("keeps review events append-only", async () => {
    const reviews = new DexieReviewRepository(database);
    const sessionId = testIds.next();
    const card = createCardFixture(testIds.next());
    const review = {
      id: testIds.next(),
      cardId: card.id,
      sessionId,
      rating: "good" as const,
      reviewedAt: testInstant,
      durationMs: 500,
      previousScheduling: card.scheduling,
      newScheduling: { ...card.scheduling, intervalDays: 1 },
      deviceId: testIds.next(),
    };
    await reviews.append(review);
    await expect(reviews.append(review)).rejects.toBeInstanceOf(ConflictError);
    expect(await reviews.listByCard(card.id)).toEqual([review]);
  });

  it("stores sessions and ordered items", async () => {
    const sessions = new DexieStudySessionRepository(database);
    const session = {
      id: testIds.next(),
      deckId: null,
      startedAt: testInstant,
      completedAt: null,
      reviewedCount: 0,
    };
    await sessions.save(session);
    await sessions.saveItem({
      id: testIds.next(),
      sessionId: session.id,
      cardId: testIds.next(),
      position: 0,
      revealedAt: null,
      reviewedAt: null,
    });
    expect(await sessions.findById(session.id)).toEqual(session);
    expect(await sessions.listItems(session.id)).toHaveLength(1);
  });

  it("rolls back all writes when an atomic operation fails", async () => {
    const decks = new DexieDeckRepository(database);
    const transactions = new DexieTransactionRunner(database);
    const deck = createDeckFixture();

    await expect(
      transactions.run(async () => {
        await decks.save(deck);
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    expect(await decks.findById(deck.id)).toBeNull();
  });

  it("upgrades an existing v1 database without losing decks", async () => {
    const name = `hafiza-upgrade-${testIds.next()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      decks: "id, active, name, folderId, [active+name], [folderId+active]",
      cards:
        "id, active, deckId, dueAt, normalizedFront, [deckId+active], [active+dueAt], [deckId+active+dueAt]",
      tags: "id, name, deletedAt",
      folders: "id, parentId, name, deletedAt",
      cardTags: "[cardId+tagId], cardId, tagId",
      reviews: "id, cardId, sessionId, reviewedAt, [cardId+reviewedAt]",
      sessions: "id, deckId, startedAt, completedAt",
      sessionItems: "id, sessionId, cardId, [sessionId+position]",
      dailyStats: "date",
      syncOperations: "id, status, occurredAt, [status+occurredAt]",
    });
    const deck = createDeckFixture();
    await legacy.table("decks").put({ ...deck, active: 1 });
    legacy.close();

    const upgraded = new HafizaDatabase(name);
    expect(await upgraded.decks.get(deck.id)).toMatchObject({
      name: deck.name,
    });
    expect(upgraded.tables.map((table) => table.name)).toContain("devices");
    expect(upgraded.tables.map((table) => table.name)).toContain(
      "appliedSyncOperations",
    );
    await upgraded.delete();
  });
});
