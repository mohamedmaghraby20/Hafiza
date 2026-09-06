import type { EntityId, Page, PageRequest } from "@shared/index";

import type { Deck } from "./Deck";

export interface DeckRepository {
  save(deck: Deck): Promise<void>;
  findById(id: EntityId, includeDeleted?: boolean): Promise<Deck | null>;
  findByName(name: string): Promise<Deck | null>;
  softDelete(id: EntityId, deletedAt: Date, deviceId: EntityId): Promise<void>;
  restore(id: EntityId, restoredAt: Date, deviceId: EntityId): Promise<void>;
  list(page: PageRequest): Promise<Page<Deck>>;
  listByFolder(
    folderId: EntityId | null,
    page: PageRequest,
  ): Promise<Page<Deck>>;
}
