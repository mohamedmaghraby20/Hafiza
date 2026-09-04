import type { EntityId } from "@shared/index";
import type {
  HafizaDatabase,
  PersistedCard,
  PersistedDeck,
} from "@shared/infrastructure/database";
import type { ReviewEvent } from "@modules/study";
import type { Folder, Tag } from "@modules/library";

import type {
  JournalOperation,
  RemoteJournalProvider,
  SyncJournal,
} from "../domain/SyncJournal";

export interface SyncResult {
  readonly pushed: number;
  readonly pulled: number;
}

function wins(
  remote: { revision: number; updatedAt: Date; updatedByDeviceId: EntityId },
  local:
    | { revision: number; updatedAt: Date; updatedByDeviceId: EntityId }
    | undefined,
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

function revivePayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
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

export class IncrementalSyncService {
  constructor(
    private readonly database: HafizaDatabase,
    private readonly remote: RemoteJournalProvider,
  ) {}

  async sync(deviceId: EntityId, accessToken: string): Promise<SyncResult> {
    const journals = await this.remote.list(accessToken);
    let pulled = 0;
    for (const journal of journals) pulled += await this.apply(journal);

    const pending = await this.database.syncOperations
      .where("status")
      .equals("pending")
      .sortBy("occurredAt");
    if (pending.length === 0) return { pushed: 0, pulled };
    const own = journals.find((journal) => journal.deviceId === deviceId);
    const existingIds = new Set(
      own?.operations.map((operation) => operation.id) ?? [],
    );
    const additions: JournalOperation[] = [];
    for (const operation of pending) {
      if (existingIds.has(operation.id)) continue;
      const payload = await this.payload(
        operation.entityType,
        operation.entityId,
      );
      if (payload) additions.push({ ...operation, payload });
    }
    const journal: SyncJournal = {
      format: "hafiza-sync",
      formatVersion: 1,
      deviceId,
      updatedAt: new Date().toISOString(),
      operations: [...(own?.operations ?? []), ...additions],
    };
    await this.remote.save(journal, accessToken);
    await this.database.syncOperations.bulkPut(
      pending.map((operation) => ({ ...operation, status: "synced" as const })),
    );
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
    return this.database.reviews.get(id);
  }

  private apply(journal: SyncJournal): Promise<number> {
    return this.database.transaction("rw", this.database.tables, async () => {
      let applied = 0;
      for (const operation of journal.operations) {
        if (await this.database.appliedSyncOperations.get(operation.id))
          continue;
        const payload = revivePayload(operation.payload);
        if (operation.entityType === "card") {
          const card = payload as PersistedCard;
          const local = await this.database.cards.get(card.id);
          if (wins(card, local)) await this.database.cards.put(card);
        } else if (operation.entityType === "deck") {
          const deck = payload as PersistedDeck;
          const local = await this.database.decks.get(deck.id);
          if (wins(deck, local)) await this.database.decks.put(deck);
        } else if (operation.entityType === "tag") {
          const tag = payload as Tag;
          const local = await this.database.tags.get(tag.id);
          if (wins(tag, local)) await this.database.tags.put(tag);
        } else if (operation.entityType === "folder") {
          const folder = payload as Folder;
          const local = await this.database.folders.get(folder.id);
          if (wins(folder, local)) await this.database.folders.put(folder);
        } else {
          const review = payload as ReviewEvent;
          if (!(await this.database.reviews.get(review.id)))
            await this.database.reviews.add(review);
        }
        await this.database.appliedSyncOperations.put({
          id: operation.id,
          appliedAt: new Date(),
        });
        applied += 1;
      }
      return applied;
    });
  }
}
