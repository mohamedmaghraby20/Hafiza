import type { EntityId, SyncedEntity } from "@shared/index";

export interface Tag extends SyncedEntity {
  readonly name: string;
}

export interface Folder extends SyncedEntity {
  readonly name: string;
  readonly parentId: EntityId | null;
}

export interface CardTag {
  readonly cardId: EntityId;
  readonly tagId: EntityId;
  readonly createdAt: Date;
}
