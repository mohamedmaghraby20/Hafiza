import type { EntityId } from "@shared/index";

import type { CardAsset } from "./CardAsset";

export interface CardAssetRepository {
  listByCard(cardId: EntityId): Promise<readonly CardAsset[]>;
  listByCards(cardIds: readonly EntityId[]): Promise<readonly CardAsset[]>;
  replaceForCard(cardId: EntityId, assets: readonly CardAsset[]): Promise<void>;
  softDelete(id: EntityId, deletedAt: Date, deviceId: EntityId): Promise<void>;
}
