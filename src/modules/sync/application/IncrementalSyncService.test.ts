import { afterEach, describe, expect, it } from "vitest";

import type { RemoteJournalProvider, SyncJournal } from "@modules/sync";
import { HafizaDatabase } from "@shared/infrastructure/database";
import { createDeckFixture, testIds } from "@test/domainFixtures";

import { IncrementalSyncService } from "./IncrementalSyncService";

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
  });
});
