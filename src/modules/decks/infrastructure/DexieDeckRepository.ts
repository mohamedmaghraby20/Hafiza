import type { EntityId, Page, PageRequest } from "@shared/index";
import { NotFoundError } from "@shared/index";
import type { HafizaDatabase } from "@shared/infrastructure/database/HafizaDatabase";
import {
  toDeck,
  toPersistedDeck,
} from "@shared/infrastructure/database/mappers";

import type { Deck } from "../domain/Deck";
import type { DeckRepository } from "../domain/DeckRepository";

export class DexieDeckRepository implements DeckRepository {
  constructor(private readonly database: HafizaDatabase) {}

  async save(deck: Deck): Promise<void> {
    await this.database.decks.put(toPersistedDeck(deck));
  }

  async findById(id: EntityId, includeDeleted = false): Promise<Deck | null> {
    const deck = await this.database.decks.get(id);
    return deck && (includeDeleted || deck.active === 1) ? toDeck(deck) : null;
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

  async list(page: PageRequest): Promise<Page<Deck>> {
    const collection = this.database.decks.where("active").equals(1);
    const [items, total] = await Promise.all([
      collection.clone().offset(page.offset).limit(page.limit).sortBy("name"),
      collection.count(),
    ]);
    return { items: items.map(toDeck), total };
  }

  async listByFolder(
    folderId: EntityId | null,
    page: PageRequest,
  ): Promise<Page<Deck>> {
    const collection =
      folderId === null
        ? this.database.decks
            .where("active")
            .equals(1)
            .filter((deck) => deck.folderId === null)
        : this.database.decks.where("[folderId+active]").equals([folderId, 1]);
    const [items, total] = await Promise.all([
      collection.clone().offset(page.offset).limit(page.limit).toArray(),
      collection.count(),
    ]);
    return { items: items.map(toDeck), total };
  }

  private async changeDeletion(
    id: EntityId,
    deletedAt: Date | null,
    updatedAt: Date,
    deviceId: EntityId,
  ): Promise<void> {
    const existing = await this.database.decks.get(id);
    if (!existing) throw new NotFoundError("Deck", id);
    await this.save({
      ...toDeck(existing),
      deletedAt,
      updatedAt,
      updatedByDeviceId: deviceId,
      revision: existing.revision + 1,
    });
  }
}
