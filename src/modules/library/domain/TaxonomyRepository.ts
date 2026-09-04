import type { EntityId } from "@shared/index";

import type { CardTag, Folder, Tag } from "./Taxonomy";

export interface TagRepository {
  save(tag: Tag): Promise<void>;
  findById(id: EntityId): Promise<Tag | null>;
  list(): Promise<readonly Tag[]>;
}

export interface FolderRepository {
  save(folder: Folder): Promise<void>;
  findById(id: EntityId): Promise<Folder | null>;
  list(): Promise<readonly Folder[]>;
}

export interface CardTagRepository {
  replaceForCard(cardId: EntityId, links: readonly CardTag[]): Promise<void>;
  listForCard(cardId: EntityId): Promise<readonly CardTag[]>;
}
