import { z } from "zod";

import type { HafizaDatabase } from "@shared/infrastructure/database";

import type { BackupProvider, HafizaBackup } from "../domain/Backup";

const backupSchema = z.object({
  format: z.literal("hafiza"),
  formatVersion: z.literal(1),
  appVersion: z.string(),
  exportedAt: z.string(),
  data: z.object({
    decks: z.array(z.looseObject({ id: z.string() })),
    cards: z.array(z.looseObject({ id: z.string() })),
    assets: z
      .array(z.looseObject({ id: z.string(), cardId: z.string() }))
      .default([]),
    tags: z.array(z.looseObject({ id: z.string() })),
    folders: z.array(z.looseObject({ id: z.string() })),
    cardTags: z.array(z.looseObject({ cardId: z.string(), tagId: z.string() })),
    reviews: z.array(z.looseObject({ id: z.string() })),
    sessions: z.array(z.looseObject({ id: z.string() })),
    sessionItems: z.array(z.looseObject({ id: z.string() })),
    dailyStats: z.array(z.looseObject({ date: z.string() })),
    syncOperations: z.array(z.looseObject({ id: z.string() })),
    devices: z.array(z.looseObject({ id: z.string() })),
    appliedSyncOperations: z.array(z.looseObject({ id: z.string() })),
    syncCursors: z
      .array(z.looseObject({ deviceId: z.string(), lastSequence: z.number() }))
      .default([]),
  }),
});

const dateKeys = new Set([
  "createdAt",
  "updatedAt",
  "deletedAt",
  "dueAt",
  "reviewedAt",
  "startedAt",
  "completedAt",
  "revealedAt",
  "occurredAt",
  "appliedAt",
]);

function reviveDates(value: unknown, key = ""): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value === "string" && dateKeys.has(key)
      ? new Date(value)
      : value;
  }
  if (Array.isArray(value)) return value.map((item) => reviveDates(item));
  return Object.fromEntries(
    Object.entries(value).map(([name, item]) => [
      name,
      reviveDates(item, name),
    ]),
  );
}

export class DexieBackupProvider implements BackupProvider {
  constructor(private readonly database: HafizaDatabase) {}

  async create(): Promise<HafizaBackup> {
    const [
      decks,
      cards,
      assets,
      tags,
      folders,
      cardTags,
      reviews,
      sessions,
      sessionItems,
      dailyStats,
      syncOperations,
      devices,
      appliedSyncOperations,
      syncCursors,
    ] = await Promise.all([
      this.database.decks.toArray(),
      this.database.cards.toArray(),
      this.database.assets.toArray(),
      this.database.tags.toArray(),
      this.database.folders.toArray(),
      this.database.cardTags.toArray(),
      this.database.reviews.toArray(),
      this.database.sessions.toArray(),
      this.database.sessionItems.toArray(),
      this.database.dailyStats.toArray(),
      this.database.syncOperations.toArray(),
      this.database.devices.toArray(),
      this.database.appliedSyncOperations.toArray(),
      this.database.syncCursors.toArray(),
    ]);
    return {
      format: "hafiza",
      formatVersion: 1,
      appVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      data: {
        decks,
        cards,
        assets,
        tags,
        folders,
        cardTags,
        reviews,
        sessions,
        sessionItems,
        dailyStats,
        syncOperations,
        devices,
        appliedSyncOperations,
        syncCursors,
      },
    };
  }

  parse(serialized: string): HafizaBackup {
    return reviveDates(
      backupSchema.parse(JSON.parse(serialized)),
    ) as HafizaBackup;
  }

  restore(backup: HafizaBackup): Promise<void> {
    return this.database.transaction("rw", this.database.tables, async () => {
      await Promise.all([
        this.database.decks.clear(),
        this.database.cards.clear(),
        this.database.assets.clear(),
        this.database.tags.clear(),
        this.database.folders.clear(),
        this.database.cardTags.clear(),
        this.database.reviews.clear(),
        this.database.sessions.clear(),
        this.database.sessionItems.clear(),
        this.database.dailyStats.clear(),
        this.database.syncOperations.clear(),
        this.database.devices.clear(),
        this.database.appliedSyncOperations.clear(),
        this.database.syncCursors.clear(),
      ]);
      await Promise.all([
        this.database.decks.bulkPut([...backup.data.decks]),
        this.database.cards.bulkPut([...backup.data.cards]),
        this.database.assets.bulkPut([...backup.data.assets]),
        this.database.tags.bulkPut([...backup.data.tags]),
        this.database.folders.bulkPut([...backup.data.folders]),
        this.database.cardTags.bulkPut([...backup.data.cardTags]),
        this.database.reviews.bulkPut([...backup.data.reviews]),
        this.database.sessions.bulkPut([...backup.data.sessions]),
        this.database.sessionItems.bulkPut([...backup.data.sessionItems]),
        this.database.dailyStats.bulkPut([...backup.data.dailyStats]),
        this.database.syncOperations.bulkPut([...backup.data.syncOperations]),
        this.database.devices.bulkPut([...backup.data.devices]),
        this.database.appliedSyncOperations.bulkPut([
          ...backup.data.appliedSyncOperations,
        ]),
        this.database.syncCursors.bulkPut([...backup.data.syncCursors]),
      ]);
    });
  }
}
