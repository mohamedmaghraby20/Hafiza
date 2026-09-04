import type { EntityId } from "./id";

export interface SyncedEntity {
  readonly id: EntityId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly revision: number;
  readonly updatedByDeviceId: EntityId;
  readonly deletedAt: Date | null;
}

export interface PageRequest {
  readonly offset: number;
  readonly limit: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
}
