import { afterEach, describe, expect, it } from "vitest";

import type { RemoteJournalProvider, SyncJournal } from "@modules/sync";
import type { EntityId } from "@shared/index";
import { HafizaDatabase } from "@shared/infrastructure/database";
import { createDeckFixture, testIds } from "@test/domainFixtures";

import {
  IncrementalSyncService,
  remoteEntityWins,
} from "./IncrementalSyncService";

class MemoryJournalProvider implements RemoteJournalProvider {
  journals: SyncJournal[] = [];

  list(): Promise<readonly SyncJournal[]> {
    return Promise.resolve(this.journals);
  }

  save(journal: SyncJournal): Promise<void> {
    this.journals = [
      ...this.journals.filter(
        (candidate) => candidate.deviceId !== journal.deviceId,
      ),
      journal,
    ];
    return Promise.resolve();
  }
}

describe("IncrementalSyncService", () => {
  const databases: HafizaDatabase[] = [];

  afterEach(async () => {
    await Promise.all(databases.map((database) => database.delete()));
    databases.length = 0;
  });

  it("pushes device journals and idempotently applies remote entities", async () => {
    const source = new HafizaDatabase(`sync-source-${testIds.next()}`);
    const target = new HafizaDatabase(`sync-target-${testIds.next()}`);
    databases.push(source, target);
    const remote = new MemoryJournalProvider();
    const deviceId = testIds.next();
    const deck = createDeckFixture();
    await source.decks.put({ ...deck, active: 1 });
    await source.syncOperations.add({
      id: testIds.next(),
      entityType: "deck",
      entityId: deck.id,
      operation: "upsert",
      occurredAt: deck.updatedAt,
      deviceId,
      status: "pending",
    });

    await expect(
      new IncrementalSyncService(source, remote).sync(deviceId, "token"),
    ).resolves.toEqual({
      pushed: 1,
      pulled: 0,
    });
    const targetSync = new IncrementalSyncService(target, remote);
    await expect(targetSync.sync(testIds.next(), "token")).resolves.toEqual({
      pushed: 0,
      pulled: 1,
    });
    expect(await target.decks.get(deck.id)).toMatchObject({ name: deck.name });
    await expect(targetSync.sync(testIds.next(), "token")).resolves.toEqual({
      pushed: 0,
      pulled: 0,
    });
    expect((await target.syncCursors.toArray())[0]?.lastSequence).toBe(1);
  });

  it("resolves synchronized entity conflicts deterministically", () => {
    const early = new Date("2026-09-04T08:00:00.000Z");
    const late = new Date("2026-09-04T09:00:00.000Z");
    const lowDevice = "00000000-0000-7000-8000-000000000001" as EntityId;
    const highDevice = "00000000-0000-7000-8000-000000000002" as EntityId;

    expect(
      remoteEntityWins(
        { revision: 2, updatedAt: early, updatedByDeviceId: lowDevice },
        { revision: 1, updatedAt: late, updatedByDeviceId: highDevice },
      ),
    ).toBe(true);
    expect(
      remoteEntityWins(
        { revision: 1, updatedAt: late, updatedByDeviceId: lowDevice },
        { revision: 2, updatedAt: early, updatedByDeviceId: highDevice },
      ),
    ).toBe(false);
    expect(
      remoteEntityWins(
        { revision: 2, updatedAt: late, updatedByDeviceId: lowDevice },
        { revision: 2, updatedAt: early, updatedByDeviceId: highDevice },
      ),
    ).toBe(true);
    expect(
      remoteEntityWins(
        { revision: 2, updatedAt: early, updatedByDeviceId: highDevice },
        { revision: 2, updatedAt: early, updatedByDeviceId: lowDevice },
      ),
    ).toBe(true);
  });

  it("applies newer tombstones and preserves newer local edits", async () => {
    const database = new HafizaDatabase(`sync-conflict-${testIds.next()}`);
    databases.push(database);
    const remote = new MemoryJournalProvider();
    const remoteDevice = testIds.next();
    const localDevice = testIds.next();
    const deck = createDeckFixture({ updatedByDeviceId: localDevice });
    await database.decks.put({ ...deck, active: 1 });

    const deletedAt = new Date(deck.updatedAt.getTime() + 1_000);
    const tombstone = {
      ...deck,
      active: 0 as const,
      deletedAt,
      updatedAt: deletedAt,
      revision: 2,
      updatedByDeviceId: remoteDevice,
    };
    remote.journals = [
      {
        format: "hafiza-sync",
        formatVersion: 2,
        deviceId: remoteDevice,
        updatedAt: deletedAt.toISOString(),
        operations: [
          {
            id: testIds.next(),
            sequence: 1,
            entityType: "deck",
            entityId: deck.id,
            operation: "delete",
            occurredAt: deletedAt,
            deviceId: remoteDevice,
            status: "synced",
            payload: tombstone,
          },
        ],
      },
    ];

    await new IncrementalSyncService(database, remote).sync(
      testIds.next(),
      "token",
    );
    expect(await database.decks.get(deck.id)).toMatchObject({
      active: 0,
      deletedAt,
      revision: 2,
    });

    const localNewer = {
      ...tombstone,
      active: 1 as const,
      deletedAt: null,
      revision: 4,
      name: "Recovered locally",
    };
    await database.decks.put(localNewer);
    const olderRemote = { ...tombstone, revision: 3, name: "Remote older" };
    remote.journals = [
      {
        ...remote.journals[0]!,
        operations: [
          ...remote.journals[0]!.operations,
          {
            ...remote.journals[0]!.operations[0]!,
            id: testIds.next(),
            sequence: 2,
            operation: "upsert",
            payload: olderRemote,
          },
        ],
      },
    ];
    await new IncrementalSyncService(database, remote).sync(
      testIds.next(),
      "token",
    );
    expect((await database.decks.get(deck.id))?.name).toBe("Recovered locally");
  });

  it("projects a remote review into local progress aggregates", async () => {
    const database = new HafizaDatabase(`sync-review-${testIds.next()}`);
    databases.push(database);
    const remote = new MemoryJournalProvider();
    const remoteDevice = testIds.next();
    const cardId = testIds.next();
    const sessionId = testIds.next();
    const reviewedAt = new Date("2026-09-05T10:00:00.000Z");
    const scheduling = {
      phase: "new" as const,
      dueAt: reviewedAt,
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
    };
    const review = {
      id: testIds.next(),
      cardId,
      sessionId,
      rating: "good" as const,
      reviewedAt,
      durationMs: 1_500,
      previousScheduling: scheduling,
      newScheduling: scheduling,
      deviceId: remoteDevice,
    };
    remote.journals = [
      {
        format: "hafiza-sync",
        formatVersion: 2,
        deviceId: remoteDevice,
        updatedAt: reviewedAt.toISOString(),
        operations: [
          {
            id: testIds.next(),
            sequence: 1,
            entityType: "review",
            entityId: review.id,
            operation: "upsert",
            occurredAt: reviewedAt,
            deviceId: remoteDevice,
            status: "synced",
            payload: review,
          },
        ],
      },
    ];

    await new IncrementalSyncService(database, remote).sync(
      testIds.next(),
      "token",
    );

    expect(await database.reviews.get(review.id)).toEqual(review);
    expect(await database.dailyStats.get("2026-09-05")).toMatchObject({
      reviewedCards: 1,
      correctReviews: 1,
      studyTimeMs: 1_500,
    });
  });

  it("rolls back remote operations and its cursor when a payload is invalid", async () => {
    const database = new HafizaDatabase(`sync-rollback-${testIds.next()}`);
    databases.push(database);
    const remote = new MemoryJournalProvider();
    const remoteDevice = testIds.next();
    const deck = createDeckFixture({ updatedByDeviceId: remoteDevice });
    remote.journals = [
      {
        format: "hafiza-sync",
        formatVersion: 2,
        deviceId: remoteDevice,
        updatedAt: deck.updatedAt.toISOString(),
        operations: [
          {
            id: testIds.next(),
            sequence: 1,
            entityType: "deck",
            entityId: deck.id,
            operation: "upsert",
            occurredAt: deck.updatedAt,
            deviceId: remoteDevice,
            status: "synced",
            payload: { ...deck, active: 1 },
          },
          {
            id: testIds.next(),
            sequence: 2,
            entityType: "deck",
            entityId: testIds.next(),
            operation: "upsert",
            occurredAt: deck.updatedAt,
            deviceId: remoteDevice,
            status: "synced",
            payload: { invalid: true },
          },
        ],
      },
    ];

    await expect(
      new IncrementalSyncService(database, remote).sync(
        testIds.next(),
        "token",
      ),
    ).rejects.toThrow();
    expect(await database.decks.get(deck.id)).toBeUndefined();
    expect(await database.syncCursors.get(remoteDevice)).toBeUndefined();
    expect(await database.appliedSyncOperations.count()).toBe(0);
  });
});
