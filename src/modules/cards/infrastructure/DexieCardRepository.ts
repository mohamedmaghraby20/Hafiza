import type { EntityId, Page, PageRequest } from "@shared/index";
import { NotFoundError } from "@shared/index";
import type { HafizaDatabase } from "@shared/infrastructure/database/HafizaDatabase";
import {
  toCard,
  toPersistedCard,
} from "@shared/infrastructure/database/mappers";

import type { Card } from "../domain/Card";
import type { CardRepository, CardSearchQuery } from "../domain/CardRepository";

export class DexieCardRepository implements CardRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async save(card: Card): Promise<void> {
    await this.database.cards.put(toPersistedCard(card));
  }

  async findById(id: EntityId, includeDeleted = false): Promise<Card | null> {
    const card = await this.database.cards.get(id);
    return card && (includeDeleted || card.active === 1) ? toCard(card) : null;
  }

  async softDelete(
    id: EntityId,
    deletedAt: Date,
    deviceId: EntityId,
  ): Promise<void> {
    await this.changeDeletion(id, deletedAt, deletedAt, deviceId);
  }

  async restore(
    id: EntityId,
    restoredAt: Date,
    deviceId: EntityId,
  ): Promise<void> {
    await this.changeDeletion(id, null, restoredAt, deviceId);
  }

  async listByDeck(deckId: EntityId, page: PageRequest): Promise<Page<Card>> {
    const collection = this.database.cards
      .where("[deckId+active]")
      .equals([deckId, 1]);
    const [items, total] = await Promise.all([
      collection.clone().offset(page.offset).limit(page.limit).toArray(),
      collection.count(),
    ]);
    return { items: items.map(toCard), total };
  }

  async listDue(
    dueBefore: Date,
    deckId?: EntityId,
    limit = 100,
  ): Promise<readonly Card[]> {
    const collection = deckId
      ? this.database.cards
          .where("[deckId+active+dueAt]")
          .between(
            [deckId, 1, Dexie.minKey],
            [deckId, 1, dueBefore],
            true,
            true,
          )
      : this.database.cards
          .where("[active+dueAt]")
          .between([1, Dexie.minKey], [1, dueBefore], true, true);
    return (await collection.limit(limit).toArray()).map(toCard);
  }

  countByDeck(deckId: EntityId): Promise<number> {
    return this.database.cards
      .where("[deckId+active]")
      .equals([deckId, 1])
      .count();
  }

  countDue(dueBefore: Date, deckId?: EntityId): Promise<number> {
    return deckId
      ? this.database.cards
          .where("[deckId+active+dueAt]")
          .between(
            [deckId, 1, Dexie.minKey],
            [deckId, 1, dueBefore],
            true,
            true,
          )
          .count()
      : this.database.cards
          .where("[active+dueAt]")
          .between([1, Dexie.minKey], [1, dueBefore], true, true)
          .count();
  }

  async search(query: CardSearchQuery): Promise<Page<Card>> {
    const text = query.text?.trim().toLocaleLowerCase();
    const collection = text
      ? this.database.cards
          .where("normalizedFront")
          .startsWithIgnoreCase(text)
          .and(
            (card) =>
              card.active === 1 &&
              (!query.deckId || card.deckId === query.deckId),
          )
      : query.deckId
        ? this.database.cards.where("[deckId+active]").equals([query.deckId, 1])
        : this.database.cards.where("active").equals(1);
    const [items, total] = await Promise.all([
      collection.clone().offset(query.offset).limit(query.limit).toArray(),
      collection.count(),
    ]);
    return { items: items.map(toCard), total };
  }

  private async changeDeletion(
    id: EntityId,
    deletedAt: Date | null,
    updatedAt: Date,
    deviceId: EntityId,
  ): Promise<void> {
    const existing = await this.database.cards.get(id);
    if (!existing) throw new NotFoundError("Card", id);
    await this.save({
      ...toCard(existing),
      deletedAt,
      updatedAt,
      updatedByDeviceId: deviceId,
      revision: existing.revision + 1,
    });
  }
}
import Dexie from "dexie";
