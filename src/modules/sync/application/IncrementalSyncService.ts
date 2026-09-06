import { z } from "zod";

import type { Folder, Tag } from "@modules/library";
import type { ReviewEvent } from "@modules/study";
import type { EntityId } from "@shared/index";
import type { CardAsset } from "@modules/cards";
import type {
  HafizaDatabase,
  PersistedCard,
  PersistedDeck,
} from "@shared/infrastructure/database";

import type {
  JournalOperation,
  RemoteJournalProvider,
  SyncJournal,
} from "../domain/SyncJournal";

export interface SyncResult {
  readonly pushed: number;
  readonly pulled: number;
}

interface ConflictMetadata {
  readonly revision: number;
  readonly updatedAt: Date;
  readonly updatedByDeviceId: EntityId;
}

export function remoteEntityWins(
  remote: ConflictMetadata,
  local: ConflictMetadata | undefined,
): boolean {
  if (!local) return true;
  return (
    remote.revision > local.revision ||
    (remote.revision === local.revision &&
      (remote.updatedAt.getTime() > local.updatedAt.getTime() ||
        (remote.updatedAt.getTime() === local.updatedAt.getTime() &&
          remote.updatedByDeviceId.localeCompare(local.updatedByDeviceId) > 0)))
  );
}

const schedulingSchema = z.object({
  phase: z.enum(["new", "learning", "review", "relearning"]),
  dueAt: z.date(),
  intervalDays: z.number().nonnegative(),
  easeFactor: z.number().positive(),
  repetitions: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
});

const syncedSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  revision: z.number().int().positive(),
  updatedByDeviceId: z.string(),
  deletedAt: z.date().nullable(),
});

const payloadSchemas = {
  deck: syncedSchema.extend({
    name: z.string(),
    description: z.string(),
    folderId: z.string().nullable(),
    active: z.union([z.literal(0), z.literal(1)]),
  }),
  card: syncedSchema.extend({
    deckId: z.string(),
    kind: z
      .enum(["basic", "basic-reverse", "cloze", "rich-media"])
      .default("basic"),
    front: z.string(),
    back: z.string(),
    scheduling: schedulingSchema,
    active: z.union([z.literal(0), z.literal(1)]),
    dueAt: z.date(),
    normalizedFront: z.string(),
    frontFormat: z.enum(["plain", "rich"]).optional(),
    backFormat: z.enum(["plain", "rich"]).optional(),
    assetIds: z.array(z.string()).optional(),
  }),
  tag: syncedSchema.extend({ name: z.string() }),
  folder: syncedSchema.extend({
    name: z.string(),
    parentId: z.string().nullable(),
  }),
  review: z.object({
    id: z.string(),
    cardId: z.string(),
    sessionId: z.string(),
    rating: z.enum(["again", "hard", "good", "easy"]),
    reviewedAt: z.date(),
    durationMs: z.number().nonnegative(),
    previousScheduling: schedulingSchema,
    newScheduling: schedulingSchema,
    deviceId: z.string(),
  }),
  asset: syncedSchema.extend({
    cardId: z.string(),
    kind: z.enum(["image", "audio"]),
    side: z.enum(["front", "back"]).optional().default("front"),
    name: z.string(),
    mimeType: z.string(),
    data: z.string(),
    size: z.number().nonnegative(),
  }),
} as const;

function revivePayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(revivePayload);
  const dateKeys = new Set([
    "createdAt",
    "updatedAt",
    "deletedAt",
    "dueAt",
    "reviewedAt",
  ]);
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" && dateKeys.has(key)
        ? new Date(item)
        : revivePayload(item),
    ]),
  );
}

function validatedPayload(operation: JournalOperation): unknown {
  const payload = payloadSchemas[operation.entityType].parse(
    revivePayload(operation.payload),
  );
  if (payload.id !== operation.entityId) {
    throw new Error("A sync operation referenced a different entity ID.");
  }
  return payload;
}

export class IncrementalSyncService {
  constructor(
    private readonly database: HafizaDatabase,
    private readonly remote: RemoteJournalProvider,
  ) {}

  async sync(deviceId: EntityId, accessToken: string): Promise<SyncResult> {
    const journals = await this.remote.list(accessToken);
    let pulled = 0;
    for (const journal of journals) {
      if (journal.deviceId !== deviceId) pulled += await this.apply(journal);
    }

    const pending = (
      await this.database.syncOperations
        .where("status")
        .equals("pending")
        .sortBy("occurredAt")
    ).sort(
      (left, right) =>
        left.occurredAt.getTime() - right.occurredAt.getTime() ||
        left.id.localeCompare(right.id),
    );
    if (pending.length === 0) return { pushed: 0, pulled };

    const own = journals.find((journal) => journal.deviceId === deviceId);
    const existingIds = new Set(
      own?.operations.map((operation) => operation.id) ?? [],
    );
    const acknowledgedIds = new Set<EntityId>();
    const additions: JournalOperation[] = [];
    let sequence = Math.max(
      0,
      ...(own?.operations.map((operation) => operation.sequence) ?? []),
    );
    for (const operation of pending) {
      if (existingIds.has(operation.id)) {
        acknowledgedIds.add(operation.id);
        continue;
      }
      const payload = await this.payload(
        operation.entityType,
        operation.entityId,
      );
      if (!payload) {
        throw new Error(
          `Cannot sync missing ${operation.entityType} '${operation.entityId}'.`,
        );
      }
      sequence += 1;
      additions.push({ ...operation, sequence, payload });
      acknowledgedIds.add(operation.id);
    }

    if (additions.length > 0) {
      const journal: SyncJournal = {
        format: "hafiza-sync",
        formatVersion: 2,
        deviceId,
        updatedAt: new Date().toISOString(),
        operations: [...(own?.operations ?? []), ...additions],
      };
      await this.remote.save(journal, accessToken);
    }

    const acknowledged = pending.filter((operation) =>
      acknowledgedIds.has(operation.id),
    );
    if (acknowledged.length > 0) {
      await this.database.syncOperations.bulkPut(
        acknowledged.map((operation) => ({
          ...operation,
          status: "synced" as const,
        })),
      );
    }
    return { pushed: additions.length, pulled };
  }

  private async payload(
    entityType: JournalOperation["entityType"],
    id: EntityId,
  ): Promise<unknown> {
    if (entityType === "card") return this.database.cards.get(id);
    if (entityType === "deck") return this.database.decks.get(id);
    if (entityType === "tag") return this.database.tags.get(id);
    if (entityType === "folder") return this.database.folders.get(id);
    if (entityType === "asset") return this.database.assets.get(id);
    return this.database.reviews.get(id);
  }

  private apply(journal: SyncJournal): Promise<number> {
    return this.database.transaction("rw", this.database.tables, async () => {
      const cursor = await this.database.syncCursors.get(journal.deviceId);
      const operations = [...journal.operations].sort(
        (left, right) => left.sequence - right.sequence,
      );
      let applied = 0;
      let lastSequence = cursor?.lastSequence ?? 0;
      for (const operation of operations) {
        if (operation.sequence <= lastSequence) continue;
        if (operation.deviceId !== journal.deviceId) {
          throw new Error(
            "A journal contains an operation from another device.",
          );
        }
        const payload = validatedPayload(operation);
        const alreadyApplied = await this.database.appliedSyncOperations.get(
          operation.id,
        );
        if (!alreadyApplied) {
          await this.applyOperation(operation, payload);
          await this.database.appliedSyncOperations.put({
            id: operation.id,
            appliedAt: new Date(),
          });
          applied += 1;
        }
        lastSequence = operation.sequence;
      }
      if (lastSequence > (cursor?.lastSequence ?? 0)) {
        await this.database.syncCursors.put({
          deviceId: journal.deviceId,
          lastSequence,
          updatedAt: new Date(),
        });
      }
      return applied;
    });
  }

  private async applyOperation(
    operation: JournalOperation,
    payload: unknown,
  ): Promise<void> {
    if (operation.entityType === "card") {
      const card = payload as PersistedCard;
      const local = await this.database.cards.get(card.id);
      if (remoteEntityWins(card, local)) await this.database.cards.put(card);
    } else if (operation.entityType === "deck") {
      const deck = payload as PersistedDeck;
      const local = await this.database.decks.get(deck.id);
      if (remoteEntityWins(deck, local)) await this.database.decks.put(deck);
    } else if (operation.entityType === "tag") {
      const tag = payload as Tag;
      const local = await this.database.tags.get(tag.id);
      if (remoteEntityWins(tag, local)) await this.database.tags.put(tag);
    } else if (operation.entityType === "folder") {
      const folder = payload as Folder;
      const local = await this.database.folders.get(folder.id);
      if (remoteEntityWins(folder, local))
        await this.database.folders.put(folder);
    } else if (operation.entityType === "asset") {
      const asset = payload as CardAsset;
      const local = await this.database.assets.get(asset.id);
      if (remoteEntityWins(asset, local)) await this.database.assets.put(asset);
    } else {
      const review = payload as ReviewEvent;
      if (!(await this.database.reviews.get(review.id))) {
        await this.database.reviews.add(review);
        const date = review.reviewedAt.toISOString().slice(0, 10);
        const daily = (await this.database.dailyStats.get(date)) ?? {
          date,
          reviewedCards: 0,
          correctReviews: 0,
          studyTimeMs: 0,
        };
        await this.database.dailyStats.put({
          ...daily,
          reviewedCards: daily.reviewedCards + 1,
          correctReviews:
            daily.correctReviews + (review.rating === "again" ? 0 : 1),
          studyTimeMs: daily.studyTimeMs + review.durationMs,
        });
        const session = await this.database.sessions.get(review.sessionId);
        if (session) {
          await this.database.sessions.put({
            ...session,
            reviewedCount: session.reviewedCount + 1,
          });
        }
        const sessionItem = await this.database.sessionItems
          .where("sessionId")
          .equals(review.sessionId)
          .filter((item) => item.cardId === review.cardId)
          .first();
        if (sessionItem && !sessionItem.reviewedAt) {
          await this.database.sessionItems.put({
            ...sessionItem,
            reviewedAt: review.reviewedAt,
          });
        }
      }
    }
  }
}
