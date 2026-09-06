import type { EntityId } from "@shared/index";
import type { HafizaDatabase } from "@shared/infrastructure/database";

import type { CardAsset } from "../domain/CardAsset";
import type { CardAssetRepository } from "../domain/CardAssetRepository";

export class DexieCardAssetRepository implements CardAssetRepository {
  constructor(private readonly database: HafizaDatabase) {}

  listByCard(cardId: EntityId): Promise<readonly CardAsset[]> {
    return this.database.assets
      .where("cardId")
      .equals(cardId)
      .filter((asset) => asset.deletedAt === null)
      .toArray();
  }

  listByCards(cardIds: readonly EntityId[]): Promise<readonly CardAsset[]> {
    if (cardIds.length === 0) return Promise.resolve([]);
    return this.database.assets
      .where("cardId")
      .anyOf([...cardIds])
      .filter((asset) => asset.deletedAt === null)
      .toArray();
  }

  async replaceForCard(
    cardId: EntityId,
    assets: readonly CardAsset[],
  ): Promise<void> {
    if (assets.length > 0) await this.database.assets.bulkPut([...assets]);
  }

  async softDelete(
    id: EntityId,
    deletedAt: Date,
    deviceId: EntityId,
  ): Promise<void> {
    const asset = await this.database.assets.get(id);
    if (!asset) return;
    await this.database.assets.put({
      ...asset,
      updatedAt: deletedAt,
      revision: asset.revision + 1,
      updatedByDeviceId: deviceId,
      deletedAt,
    });
  }
}
