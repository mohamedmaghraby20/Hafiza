import type { EntityId, Page, PageRequest } from "@shared/index";

import type { Card } from "./Card";

export interface CardSearchQuery extends PageRequest {
  readonly deckId?: EntityId;
  readonly text?: string;
}

export interface CardRepository {
  save(card: Card): Promise<void>;
  findById(id: EntityId, includeDeleted?: boolean): Promise<Card | null>;
  softDelete(id: EntityId, deletedAt: Date, deviceId: EntityId): Promise<void>;
  restore(id: EntityId, restoredAt: Date, deviceId: EntityId): Promise<void>;
  listByDeck(deckId: EntityId, page: PageRequest): Promise<Page<Card>>;
  listDue(
    dueBefore: Date,
    deckId?: EntityId,
    limit?: number,
  ): Promise<readonly Card[]>;
  countByDeck(deckId: EntityId): Promise<number>;
  countDue(dueBefore: Date, deckId?: EntityId): Promise<number>;
  search(query: CardSearchQuery): Promise<Page<Card>>;
}
