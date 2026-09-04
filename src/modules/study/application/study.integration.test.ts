import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DexieCardRepository } from "@modules/cards";
import { DexieDeckRepository } from "@modules/decks";
import {
  DexieDailyStudyStatsRepository,
  DexieReviewRepository,
  DexieStudySessionRepository,
  DexieSyncOperationRepository,
  MvpScheduler,
  ReviewCardUseCase,
  StudyQueue,
  StudySessionService,
  type SyncOperationRepository,
} from "@modules/study";
import { FixedClock, UuidV7IdGenerator } from "@shared/index";
import {
  DexieTransactionRunner,
  HafizaDatabase,
} from "@shared/infrastructure/database";
import { createCardFixture, createDeckFixture } from "@test/domainFixtures";

describe("local study flow", () => {
  const ids = new UuidV7IdGenerator();
  const now = new Date("2026-09-04T08:00:00.000Z");
  const clock = new FixedClock(now);
  const deviceId = ids.next();
  let database: HafizaDatabase;
  let cards: DexieCardRepository;
  let reviews: DexieReviewRepository;
  let sessions: DexieStudySessionRepository;
  let stats: DexieDailyStudyStatsRepository;
  let sync: DexieSyncOperationRepository;
  let transactions: DexieTransactionRunner;

  beforeEach(() => {
    database = new HafizaDatabase(`study-test-${ids.next()}`);
    cards = new DexieCardRepository(database);
    reviews = new DexieReviewRepository(database);
    sessions = new DexieStudySessionRepository(database);
    stats = new DexieDailyStudyStatsRepository(database);
    sync = new DexieSyncOperationRepository(database);
    transactions = new DexieTransactionRunner(database);
  });

  afterEach(async () => database.delete());

  function reviewUseCase(syncOperations: SyncOperationRepository = sync) {
    return new ReviewCardUseCase(
      cards,
      reviews,
      sessions,
      stats,
      syncOperations,
      new MvpScheduler(),
      transactions,
      clock,
      ids,
    );
  }

  it("selects due cards deterministically and completes a study session", async () => {
    const decks = new DexieDeckRepository(database);
    const deck = createDeckFixture();
    const later = createCardFixture(deck.id, {
      scheduling: {
        ...createCardFixture(deck.id).scheduling,
        dueAt: new Date(now.getTime() - 1_000),
      },
    });
    const earlier = createCardFixture(deck.id, {
      scheduling: {
        ...later.scheduling,
        dueAt: new Date(now.getTime() - 2_000),
      },
    });
    await decks.save(deck);
    await cards.save(later);
    await cards.save(earlier);

    const queue = new StudyQueue(cards);
    expect((await queue.build(now, deck.id)).map((card) => card.id)).toEqual([
      earlier.id,
      later.id,
    ]);

    const service = new StudySessionService(
      sessions,
      cards,
      queue,
      reviewUseCase(),
      transactions,
      clock,
      ids,
    );
    const session = await service.start({ deckId: deck.id });
    const next = await service.next(session.id);
    expect(next?.card.id).toBe(earlier.id);
    if (!next) return;
    await service.reveal(next.item.id);
    await service.rate({
      sessionItemId: next.item.id,
      rating: "good",
      deviceId,
    });
    expect(await reviews.listByCard(earlier.id)).toHaveLength(1);
    expect((await stats.findByDate("2026-09-04"))?.reviewedCards).toBe(1);
    expect(await database.syncOperations.count()).toBe(2);
    expect((await service.complete(session.id)).completedAt).toEqual(now);
  });

  it("rolls back the whole review when sync metadata cannot be queued", async () => {
    const deck = createDeckFixture();
    const card = createCardFixture(deck.id);
    const session = {
      id: ids.next(),
      deckId: deck.id,
      startedAt: now,
      completedAt: null,
      reviewedCount: 0,
    };
    const item = {
      id: ids.next(),
      sessionId: session.id,
      cardId: card.id,
      position: 0,
      revealedAt: now,
      reviewedAt: null,
    };
    await cards.save(card);
    await sessions.save(session);
    await sessions.saveItem(item);
    const failingSync: SyncOperationRepository = {
      enqueue(): Promise<void> {
        return Promise.reject(new Error("queue unavailable"));
      },
    };

    await expect(
      reviewUseCase(failingSync).execute({
        cardId: card.id,
        sessionId: session.id,
        sessionItemId: item.id,
        rating: "good",
        durationMs: 100,
        deviceId,
      }),
    ).rejects.toThrow("queue unavailable");

    expect(await reviews.listByCard(card.id)).toHaveLength(0);
    expect((await cards.findById(card.id))?.revision).toBe(1);
    expect(await stats.findByDate("2026-09-04")).toBeNull();
  });
});
